export const GEAR_FUNCTION = {
    engine: 'js',
    code: `#!js api_version=1.0 name=lib1
    redis.registerFunction('foo', ()=>{return 'bar'})`,
    library: {
        NAME: 'lib1',
        foo: {
            NAME: 'lib1.foo',
            IS_READ_ONLY: true,
            NUMBER_OF_KEYS: 0,

        },
    }
}

export const GEAR_ASYNC_FUNCTION = {
    engine: 'js',
    code: `#!js api_version=1.0 name=lib1
    redis.registerAsyncFunction('asyncFoo', ()=>{return 'asyncbar'})`,
    library: {
        NAME: 'lib1',
        asyncFoo: {
            NAME: 'lib1.asyncFoo',
            IS_READ_ONLY: true,
            NUMBER_OF_KEYS: 0,
        }
    }
}
