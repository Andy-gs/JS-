// 手写 bind

// bind 用法
// 1.第一个参数是绑定 fn 在将来执行的时候，它的 this 指向
// 2.后面的参数是到时候调用的时候，会把后面的参数带上，会产生一个新的函数
// 3.将来在调用 newFn 的时候，实际上是在内部调用 fn，并且把 this 指向 bind 函数第一个参数
// 4.newFn 的参数列表就是 bind 除第一个参数的后面的参数以及 newFn 的参数，参数按照顺序传递

function fn(a, b, c, d) {
    console.log(a, b, c, d)
    console.log(this)
    return 123
}

// bind 每一个函数都能用，所以写在 Function.prototype 上

Function.prototype.woBind = function (ctx) {
    // 伪数组，用下面方法转为数组，MDN 上有介绍
    var args = Array.prototype.slice.call(arguments, 1)
    // bind 调用时，它的 this 一定是 fn
    // 暂存 fn
    var fn = this
    // bind 返回一个新的函数
    return function Wo() {
        // 这里拿到 newFn 的参数
        var restArgs = Array.prototype.slice.call(arguments)
        // 拼接参数
        var allArgs = args.concat(restArgs)
        // 判断 newFn 是不是通过 new 关键字调用的<MDN 有详细描述>
        // 是不是通过 new 调用的就需要判断原型了，可以通过判断 Wo 函数内部 this 的原型是不是和 Wo 函数的原型一致
        if (Object.getPrototypeOf(this) === Wo.prototype) {
            // 判断通过，那 fn 也使用同样的方式调用
            // 可以不使用 ES6
            // return new fn(...allArgs)
            // 可以手写 this，只不过麻烦一些
            var obj = {}
            Object.setPrototypeOf(obj, fn.prototype)
            fn.apply(obj, allArgs) // 还可以完善一些，还要判断返回结果
            return obj
        }
        // 调用fn，并传入参数
        // newFn 的返回值需要和 fn 的返回值一致，需要 return
        return fn.apply(ctx, allArgs)
    }
}

const newFn = fn.woBind('ctx', 1, 2)
const result = new newFn(3, 4) // 1,2,3,4  'ctx'
console.log(result)