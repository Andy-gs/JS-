// 手写 Promise

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