// 手写 call

function fn(a, b) {
    console.log(this, a, b)
    return a + b
}

Function.prototype.woCall = function (ctx, ...args) {
    // ctx 类型不确定，要做参数归一化
    ctx =
        // 是 undefined 或 null 就直接赋值全局 this<globalThis>
        (ctx === undefined || ctx === null)
            ? globalThis
            // 排除 undefined 或 null 之后，就剩包装类型，这里直接使用 Object(ctx) 包一层就好了
            : Object(ctx)
    // 以上处理就保证了 ctx 一定是对象

    // 保存 fn
    const fn = this
    // 调用 fn，用 ctx 调用 fn ，this 就指向 ctx 了
    // 给 ctx 造一个 fn，且要用 symbol 属性，避免与外界属性名冲突
    const key = Symbol('temp')
    // 使用直接赋值会导致 symbol 可以被枚举，使用object.defineProperty
    // ctx[key] = fn
    // ctx：给哪个对象加
    // key：加个什么东西
    // {}： 给这个 key 做配置
    Object.defineProperty(ctx, key, {
        // 枚举设置
        enumerable: false,
        // ctx.key 的值设置
        value: fn
    })
    // 调用 fn 并得到返回值，并在 call 结束时返回 result
    const result = ctx[key](...args)
    // 调用完成后需要删除 key，因为本来就是个临时的
    delete ctx[key]
    return result

}

const result = fn.woCall('ctx', 1, 2)
console.log(result)