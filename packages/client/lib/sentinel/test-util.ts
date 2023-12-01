import { createConnection } from 'node:net';
import { setTimeout } from 'node:timers/promises';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { exec } from 'node:child_process';
import { RedisSentinelOptions, RedisSentinelType } from './types';
import RedisSentinel from '.';
import RedisClient from '../client';
const execAsync = promisify(exec);

interface ErrorWithCode extends Error {
  code: string;
}

async function isPortAvailable(port: number): Promise<boolean> {
  try {
    const socket = createConnection({ port });
    await once(socket, 'connect');
    socket.end();
  } catch (err) {
    if (err instanceof Error && (err as ErrorWithCode).code === 'ECONNREFUSED') {
      return true;
    }
  }

  return false;
}

const portIterator = (async function* (): AsyncIterableIterator<number> {
  for (let i = 6379; i < 65535; i++) {
    if (await isPortAvailable(i)) {
      yield i;
    }
  }

  throw new Error('All ports are in use');
})();

export interface RedisServerDockerConfig {
  image: string;
  version: string;
}

export interface RedisServerDocker {
  port: number;
  dockerId: string;
}

abstract class DockerBase {
  async isPortAvailable(port: number): Promise<boolean> {
    try {
      const socket = createConnection({ port });
      await once(socket, 'connect');
      socket.end();
    } catch (err) {
      if (err instanceof Error && (err as ErrorWithCode).code === 'ECONNREFUSED') {
        return true;
      }
    }
  
    return false;
  }

  async spawnRedisServerDocker({ image, version }: RedisServerDockerConfig, serverArguments: Array<string>): Promise<RedisServerDocker> {
    const port = (await portIterator.next()).value;
    let cmdLine = `docker run --stop-timeout 2 --init -d --network host ${image}:${version} ${serverArguments.join(' ')}`;
    cmdLine = cmdLine.replace('{port}', `--port ${port.toString()}`);
//    console.log("spawnRedisServerDocker: cmdLine = " + cmdLine);
    const { stdout, stderr } = await execAsync(cmdLine);
  
    if (!stdout) {
      throw new Error(`docker run error - ${stderr}`);
    }
  
    while (await isPortAvailable(port)) {
      await setTimeout(50);
    }
  
    return {
      port,
      dockerId: stdout.trim()
    };
  }

  async dockerRemove(dockerId: string): Promise<void> {
    try {
      await this.dockerStop(dockerId);``
    } catch (err) {
      // its ok if stop failed, as we are just going to remove, will just be slower
      console.log(`dockerStop failed in remove: ${err}`);
    }
    
    const { stderr } = await execAsync(`docker rm -f ${dockerId}`);
    if (stderr) {
      console.log("docker rm failed");
      throw new Error(`docker rm error - ${stderr}`);
    }   
  }
  
  async dockerStop(dockerId: string): Promise<void> {
    /* this is an optimization to get around slow docker stop times, but will fail if container is already stopped */
    try {
      await execAsync(`docker exec ${dockerId} /bin/bash -c "kill -SIGINT 1"`);
    } catch (err) {
      /* this will fail if container is already not running, can be ignored */
    }

    let ret = await execAsync(`docker stop ${dockerId}`);
    if (ret.stderr) {
      throw new Error(`docker stop error - ${ret.stderr}`);
    }
  }
  
  async dockerStart(dockerId: string): Promise<void> {
    const { stderr } = await execAsync(`docker start ${dockerId}`);
    if (stderr) {
      throw new Error(`docker start error - ${stderr}`);
    }
  }  
}

export interface RedisSentinelConfig {
  numberOfNodes?: number;
  nodeDockerConfig?: RedisServerDockerConfig;
  nodeServerArguments?: Array<string>

  numberOfSentinels?: number;
  sentinelDockerConfig?: RedisServerDockerConfig;
  sentinelServerArgument?: Array<string>

  sentinelName: string;
  sentinelQuorum?: number;
}

type ArrayElement<ArrayType extends readonly unknown[]> = 
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

export interface SentinelController {
  getMaster(): Promise<string>;
  getMasterPort(): Promise<number>;
  getRandomNode(): string;
  getRandonNonMasterNode(): Promise<string>;
  getNodePort(id: string): number;
  getAllNodesPort(): Array<number>;
  getSentinelPort(id: string): number;
  getAllSentinelsPort(): Array<number>;
  getSetinel(i: number): string;
  stopNode(id: string): Promise<void>;
  restartNode(id: string): Promise<void>;
  stopSentinel(id: string): Promise<void>;
  restartSentinel(id: string): Promise<void>;
  getSentinelClient(opts?: Partial<RedisSentinelOptions<{}, {}, {}, 2, {}>>) : RedisSentinelType<{}, {}, {}, 2, {}>;
}

export class SentinelFramework extends DockerBase {
  #nodeList: Awaited<ReturnType<SentinelFramework['spawnRedisSentinelNodes']>> = [];
  /* port -> docker info/client */
  #nodeMap: Map<string, ArrayElement<Awaited<ReturnType<SentinelFramework['spawnRedisSentinelNodes']>>>>;
  #sentinelList: Awaited<ReturnType<SentinelFramework['spawnRedisSentinelSentinels']>> = [];
  /* port -> docker info/client */
  #sentinelMap: Map<string, ArrayElement<Awaited<ReturnType<SentinelFramework['spawnRedisSentinelSentinels']>>>>;

  config: RedisSentinelConfig;

  #spawned: boolean = false;

  get spawned() {
    return this.#spawned;
  }

  constructor(config: RedisSentinelConfig) {
    super();

    this.config = config;

    this.#nodeMap = new Map<string, ArrayElement<Awaited<ReturnType<SentinelFramework['spawnRedisSentinelNodes']>>>>();
    this.#sentinelMap = new Map<string, ArrayElement<Awaited<ReturnType<SentinelFramework['spawnRedisSentinelSentinels']>>>>();
  }

  getSentinelClient(opts?: Partial<RedisSentinelOptions<{}, {}, {}, 2, {}>>) : RedisSentinelType<{}, {}, {}, 2, {}>{
    if (opts?.sentinelRootNodes !== undefined) {
      throw new Error("cannot specify sentinelRootNodes here");
    }
    if (opts?.name !== undefined) {
      throw new Error("cannot specify sentinel db name here");
    }

    const options: RedisSentinelOptions<{}, {}, {}, 2, {}> = {
      name: this.config.sentinelName,
      sentinelRootNodes: [{host: '127.0.0.1',  port: this.#sentinelList[0].docker.port}],
    }

    if (opts) {
      Object.assign(options, opts);
    }

    return RedisSentinel.create(options);
  }

  async spawnRedisSentinel() {
    if (this.#spawned) {
      return;
    }

    if (this.#nodeMap.size != 0 || this.#sentinelMap.size != 0) {
      throw new Error("inconsistent state with partial setup");
    }
  
    this.#nodeList = await this.spawnRedisSentinelNodes();
    this.#nodeList.map((value) => this.#nodeMap.set(value.docker.port.toString(), value));

    this.#sentinelList = await this.spawnRedisSentinelSentinels();
    this.#sentinelList.map((value) => this.#sentinelMap.set(value.docker.port.toString(), value));

    this.#spawned = true;
  }

  async cleanup() {
    if (!this.#spawned) {
      return;
    }

    return Promise.all(
      [...this.#nodeMap!.values(), ...this.#sentinelMap!.values()].map(
        async ({docker, client}) => {
          client.destroy();
          this.dockerRemove(docker.dockerId);
        }
      )
    ).finally(async () => {
      this.#spawned = false; 
      this.#nodeMap.clear(); 
      this.#sentinelMap.clear();
    });
  }

  protected async spawnRedisSentinelNodeDocker() {
    let imageInfo: RedisServerDockerConfig = this.config.nodeDockerConfig ?? {image: "redis", version: "latest"};
    let serverArguments: Array<string> = this.config.nodeServerArguments ?? ["/usr/local/bin/redis-server", "{port}"];

    const docker = await this.spawnRedisServerDocker(imageInfo, serverArguments);
    const client = RedisClient.create({
      socket: {
        port: docker.port
      }
    }).on("error", () => {});
  
    await client.connect();
  
    return {
      docker,
      client
    };
  } 

  protected async spawnRedisSentinelNodes() {
    const master = await this.spawnRedisSentinelNodeDocker();
   
    const promises: Array<ReturnType<SentinelFramework['spawnRedisSentinelNodeDocker']>> = [];

    for (let i = 0; i < (this.config.numberOfNodes ?? 0) - 1; i++) {
      promises.push(
        this.spawnRedisSentinelNodeDocker().then(async node => {
          await node.client.replicaOf('127.0.0.1', master.docker.port);
          return node;
        })
      );
    }
  
    return [
      master,
      ...await Promise.all(promises)
    ];  
  }

  protected async spawnRedisSentinelSentinelDocker() {
    let imageInfo: RedisServerDockerConfig = this.config.nodeDockerConfig ?? {image: "redis", version: "latest"}
    let serverArguments: Array<string> = this.config.nodeServerArguments ?? 
      [
        "/bin/bash",
        "-c",
        "\"touch /tmp/sentinel.conf ; /usr/local/bin/redis-sentinel /tmp/sentinel.conf {port}\""
      ];

    const docker = await this.spawnRedisServerDocker(imageInfo, serverArguments);
    /* TODO: future might need to be a sentinel specific client */
    const client = RedisClient.create({
      socket: {
        port: docker.port
      }
    }).on("error", () => {});
  
    await client.connect();

    return {
      docker,
      client
    };
  }

  protected async spawnRedisSentinelSentinels() {
    const quorum = this.config.sentinelQuorum?.toString() ?? "2";
    const node = this.#nodeList[0];

    const promises: Array<ReturnType<SentinelFramework['spawnRedisSentinelSentinelDocker']>> = [];

    for (let i = 0; i < (this.config.numberOfSentinels ?? 3); i++) {
      promises.push(
        this.spawnRedisSentinelSentinelDocker().then(async sentinel => {
          await sentinel.client.sentinelMonitor(this.config.sentinelName, '127.0.0.1', node.docker.port.toString(), quorum);
          await sentinel.client.sentinelSet(this.config.sentinelName, 
            [
              {option: "down-after-milliseconds", value: "100"},
              {option: "failover-timeout", value: "5000"}
            ]
          );
          return sentinel;
        })
      );
    }

    return [
      ...await Promise.all(promises)
    ]
  }

  async getMaster(): Promise<string|undefined> {
    for (const sentinel of this.#sentinelMap!.values()) {
      let info;

      try {
        if (!sentinel.client.isReady) {
          continue;
        }

        info = await sentinel.client.sentinelMaster(this.config.sentinelName) as any;
      } catch (err) {
        console.log("getMaster: sentinelMaster call failed: " + err);
        continue;
      }
       
      if (this.#nodeMap.get(info.port) === undefined) {
          throw new Error("couldn't find master node for " + info.port);
        }

      return info.port;
    }

    throw new Error("Couldn't get master");
  }

  async getMasterPort(): Promise<number> {
    const data = await this.getMaster()

    return this.#nodeMap.get(data!)!.docker.port;
  }

  getRandomNode() {
    return this.#nodeList[Math.floor(Math.random() * this.#nodeList.length)].docker.port.toString();
  }

  async getRandonNonMasterNode(): Promise<string> {
    const masterPort = await this.getMasterPort();
    while (true) {
      const node = this.#nodeList[Math.floor(Math.random() * this.#nodeList.length)];
      if (node.docker.port != masterPort) {
        return node.docker.port.toString();
      }
    }
  }

  stopNode(id: string) {
    let node = this.#nodeMap.get(id);
    if (node === undefined) {
      throw new Error("unknown node: " + id);
    }

    return this.dockerStop(node.docker.dockerId);
  }

  restartNode(id: string) {
    let node = this.#nodeMap.get(id);
    if (node === undefined) {
      throw new Error("unknown node: " + id);
    }

    return this.dockerStart(node.docker.dockerId);
  }

  stopSentinel(id: string) {
    let sentinel = this.#sentinelMap.get(id);
    if (sentinel === undefined) {
      throw new Error("unknown sentinel: " + id);
    }

    return this.dockerStop(sentinel.docker.dockerId);
  }

  restartSentinel(id: string) {
    let sentinel = this.#sentinelMap.get(id);
    if (sentinel === undefined) {
      throw new Error("unknown sentinel: " + id);
    }

    return this.dockerStart(sentinel.docker.dockerId);
  }  

  getNodePort(id: string) {
    let node = this.#nodeMap.get(id);
    if (node === undefined) {
      throw new Error("unknown node: " + id);
    }

    return node.docker.port;
  }

  getAllNodesPort() {
    let ports: Array<number> = [];
    for (const node of this.#nodeList) {
      ports.push(node.docker.port);
    }

    return ports
  }

  getSentinelPort(id: string) {
    let sentinel = this.#sentinelMap.get(id);
    if (sentinel === undefined) {
      throw new Error("unknown sentinel: " + id);
    }

    return sentinel.docker.port;
  }

  getAllSentinelsPort() {
    let ports: Array<number> = [];
    for (const sentinel of this.#sentinelList) {
      ports.push(sentinel.docker.port);
    }

    return ports
  }  

  getSetinel(i: number): string {
    return this.#sentinelList[i].docker.port.toString();
  }
}
