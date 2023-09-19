// 手写 Promise
// 以下实现严格依照官方文档实现<MDN || ECMA>

// 硬编码维护困难，改成常量
const PENDING = 'pending'
const FULFILLED = 'fulfilled'
const REJECTED = 'rejected'


// 核心两点
// 1.Promise构造函数
// 2.then方法

class woPromise {
    // 私有属性，可以使用 symbol、私有字段<#>进行约束，_xxx属于弱约束，前两个属于强约束
    #state = PENDING
    // 也可以使用 void 0，我这里使用 undefined，都可以差异不大，毕竟内部私有属性不存在全局给 undefined 赋值的操作
    #result = undefined
    // then 方法可能不止调用一次，所以是个数组
    #handlers = []
    // constructor 接受一个参数，我们认为是一个任务，启动一个promise就是启动一个任务，这个任务是通过函数进行描述，可以叫做执行器
    constructor(executor) {
        // resolve 接收一个参数<data>
        const resolve = (data) => {
            this.#changeState(FULFILLED, data)
        }
        // reject 接收一个错误对象，表示错误的原因，且没有约束
        const reject = (reason) => {
            this.#changeState(REJECTED, reason)
        }
        // executor 是同步执行的，意味着要调用这个函数，执行这个任务
        // executor 调用时需要传入两个参数进来，分别是 resolve 和 reject，且都是函数
        // 执行期间报错用 try catch 处理，但是 try catch 只能捕获同步错误，目前<2023.9.16>官方也没有给出解决方案
        try {
            executor(resolve, reject)
        }
        catch (err) {
            // 执行报错进行主动调用 reject
            reject(err)
        }
    }

    // resolve 和 reject 的代码重合度较高，抽离为函数
    #changeState(state, result) {
        // promise 状态<state>一旦更改就不可再被更改 如果当前状态<state>已经被改变了那就不做任何改变
        if (this.#state !== PENDING) return
        // 调用 resolve 改变当前 promise 的状态
        // 把 result<data || reason>给 result 存起来
        this.#state = state
        this.#result = result
        this.#run()
    }
    #isPromiseLike(value) {
        // if (value instanceof woPromise)   // 不能这样判断，这样判断会失去 promise 的互操作性

        // 我们判断一个玩意到底是不是 promise，就只需要满足 Promise A+ 规范即可，只要满足就行了
        // Promise A+ 规范：value 是个 (object || function) && value.then 是一个函数即可
        if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
            return typeof value.then === 'function'
        }
        return false
    }

    #runMicroTask(func) {
        // 区分环境

        // node 判断有没有 process 并且 process.nextTick是个函数，这玩意是 node 环境中专门把函数放入微队列的方法
        if (typeof process === 'object' && typeof process.nextTick === 'function') {
            process.nextTick(func)
        }
        // window 判断有没有 MutationObserver，这个玩意可以模拟微队列运行的
        else if (typeof MutationObserver === 'function') {
            // MutationObserver 是个观察器，观察的是某一个东西有没有发生变化
            // 只要发生变化，就会运行传入的那个回调函数，并且是放到微队列里面运行的
            const ob = new MutationObserver(func)
            // 创建一个文本节点
            const text = document.createTextNode('1')
            // 观察文本节点
            ob.observe(text, {
                // 观察的是字符的变化
                characterData: true
            })
            // 手动改变字符节点
            text.data = '2'
        }
        // 都没有那就只好使用 setTimeout 了，在一些库里也是这种做法，脱离了环境给予的能力，就算是标准库也没办法
        else {
            setTimeout(func, 0)
        }
    }

    // 重复代码过多，抽离出公共部分进行重构，重构后代码简洁，更易于维护及阅读
    #runOne(callback, resolve, reject) {
        this.#runMicroTask(() => {
            // 判断是不是一个函数，不是函数就直接实现穿透
            if (typeof callback !== 'function') {
                const settled = this.#state === PENDING ? resolve : reject
                settled(this.#result)
                return
            }
            try {
                // 需要判断 data 这个返回值是不是一个 promise
                const data = callback(this.#result)
                if (this.#isPromiseLike(data)) {
                    data.then(resolve, reject)
                }
                // 不是 promise 再执行 resolve
                else {
                    resolve(data)
                }
            }
            catch (err) {
                reject(err)
            }
        })

        // // 判断是不是一个函数
        // if (typeof callback === 'function') {
        //     // 看运行过程中有没有错误，没错误就 resolve，反之 reject
        //     try {
        //         // 成功就拿到函数运行后返回的结果并执行 resolve，且把返回结果传入
        //         const data = callback(this.#result)
        //         resolve(data)
        //     } catch (err) {
        //         // 失败就直接执行 reject，并把报错信息传入
        //         reject(err)
        //     }
        // }
        // // 对应回调不是一个函数，这种情况是穿透，传入的不是函数，那么<p>成功这也是成功，<p>失败这也是失败，数据也是一样
        // else {
        //     resolve(this.#result)
        // }
    }

    // #run 方法专门用来执行 handlers 里存放的方法
    #run() {
        // 首先判断当前状态，如果是挂起<pending>状态就直接结束，成功或者失败才会执行 handlers 里的方法
        if (this.#state === PENDING) return
        // 如果不是挂起<pending>状态就可以从 handlers 中一个一个执行
        while (this.#handlers.length) {
            // 弹出第一项，解构拿到这四个方法
            const {
                onFulfilled,
                onRejected,
                resolve,
                reject
            } = this.#handlers.shift()
            // 拿出来之后判断状态
            if (this.#state === FULFILLED) {
                this.#runOne(onFulfilled, resolve, reject)
            }
            else {

                this.#runOne(onRejected, resolve, reject)
            }
        }
    }

    then(onFulfilled, onRejected) {
        // then 方法返回一个 promise
        return new woPromise((resolve, reject) => {
            // 当前 promise 不知道什么时候完成，什么时候失败，但是 #changeState 这个方法是更改状态使用的
            // 但是 #changeState 调用不到这四个函数，所以需要把这四个函数提出来，放入handlers这个数组
            this.#handlers.push({
                onFulfilled,
                onRejected,
                resolve,
                reject
            })

            this.#run()
        })
    }

    // catch 方法用于在 Promise 链进行错误处理，因为它会返回一个 Promise，所以它可以和 then() 方法一样被链式调用
    catch(onRejected) {
        // 成功的回调留空，失败回调传入就行
        return this.then(undefined, onRejected)
    }

    // finally 无论成功或者失败都要执行这个回调，通常做一些收尾工作，失败或者成功后需要做一些收尾工作
    finally(onFinally) {
        // ES6 规范 / MDN 介绍 finally 返回的 promise 和当前的 promise 的状态是一致的，所以需要完成状态穿透
        return this.then((data) => {
            // ES6 规范 / MDN 介绍 onFinally调用时不需要传入任何参数
            onFinally()
            // 成功我就返回对应数据
            return data
        }, (err) => {
            onFinally()
            // 失败我也抛个错误
            throw err
        })
    }

    // 静态方法 resolve
    static resolve(value) {
        // 如果 value 是一个 promise 就直接返回
        // 这里判断是不是 promise 不需要判断 函数/对象 是不是包含 then 方法的<promiseLike>，本来就是返回自个，下面才是对 promiseLike 的处理
        if (value instanceof woPromise) return value
        // 静态方法是不能调用实例方法的，记录一下
        let _resolve, _reject
        const p = new woPromise((resolve, reject) => {
            _resolve = resolve
            _reject = reject
        })
        // 判断这个 value 是不是一个 promiseLike
        if (p.#isPromiseLike(value)) {
            // 如果是一个 promiseLike，那就调用 then方法，并传入 _resolve 和 _reject
            value.then(_resolve, _reject)
        }
        // 除去以上情况，剩下的情况都是直接调用 resolve
        else {
            _resolve(value)
        }
        return p
    }

    // 静态 reject 是无论什么情况都直接返回一个用 promise 包裹的 reason，然后拒绝
    static reject(reason) {
        return new woPromise((resolve, reject) => {
            reject(reason)
        })
    }

    // 静态方法 all 接收一个可迭代的 promise，是个可迭代的 promise，但是不一定是个数组
    static all(proms) {
        // 保存 p 内的 resolve 和 reject，以便外面执行
        let _resolve, _reject
        const p = new woPromise((resolve, reject) => {
            _resolve = resolve
            _reject = reject
        })
        // 边界情况处理
        // 传入参数处理条件不统一，但是可迭代对象<proms>是可以用 for of 循环的
        let _count = 0
        // 数据汇总
        const result = []
        // 记录 promise 完成的数量
        let fullfilledCount = 0
        // 数据汇总下标
        let i = 0
        for (const prom of proms) {
            const index = i
            i++
            _count++
            // 如果给的数据不是 promise，那就包装一下，把每一项变成 promise
            // 需要监控成功与否，所以需要调用 then 进行观察
            // all 的特点就是但凡有一个失败，那所有都失败
            woPromise.resolve(prom).then((data) => {
                // 成功就需要把所有成功的数据汇总在 result 数组里进行保存
                // 但是 all 的数据是有顺序的，而且是按照传入的数据进行汇总的，所以不能用 push，需要用到下标，上面定义一个下标
                result[index] = data

                // 何时完成 p<promise>
                // 每完成一个 promise 数量加一
                fullfilledCount++
                if (fullfilledCount === _count) {
                    // 当与整个 promise 数量一致时调用 _resolve，异步代码，循环早就结束了
                    _resolve(result)
                }
            }, _reject)
        }
        // 如果是0，就代表一个没有，就直接完成
        if (_count === 0) {
            // 完成的数据就是一个空数组
            _resolve(result)
        }

        // all 方法返回一个 promise
        return p
    }
}



const p = new woPromise((resolve, reject) => {
    resolve(123)
})

// then 接收两个func参数，第一个是成功的函数，第二个是失败的函数
// 当这个 promise 完成的时候，可以拿到成功的数据<res>，失败的时候可以拿到失败的原因<err>
p.then((res) => {
    console.log(res, 'Promise完成')
}, (err) => {
    console.log(err, 'Promise失败')
})

new woPromise((resolve, reject) => {
    reject(123)
}).finally(() => {
    console.log('finally')
})

woPromise.all([23, 234, 435, 546, woPromise.reject(1)]).then((data) => {
    console.log(data)
}, (err) => {
    console.log(err)
})
