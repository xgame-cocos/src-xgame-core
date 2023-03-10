import { SchedulerManager } from './../scheduler/SchedulerManager';
import { Event } from '../event/Event';
import { EventDispatcher } from '../event/EventDispatcher';
import { Time } from '../scheduler/Time';

type Props<T> = {
    loop?: boolean;
    onChange?: (event?: Event) => void;
    onChangeObj?: any;
    ignoreGlobalPause?: boolean;
    useTicks?: boolean;
    override?: boolean;
    paused?: boolean;
    position?: number;
} & Partial<T>;

export class Tween<T = any> extends EventDispatcher {
    public static activeTween(): void {
        Tween._lastTime = Time.Instance().passedTime;
        SchedulerManager.Instance().registerUpdate(() => {
            Tween.tick(Time.Instance().passedTime);
        }, this);
    }

    /**
     * 不做特殊处理
     * @constant {number} egret.Tween.NONE
     * @private
     */
    private static NONE = 0;

    /**
     * 循环
     * @constant {number} egret.Tween.LOOP
     * @private
     */
    private static LOOP = 1;

    /**
     * 倒序
     * @constant {number} egret.Tween.REVERSE
     * @private
     */
    private static REVERSE = 2;

    /**
     * @private
     */
    private static _tweens: Tween[] = [];

    /**
     * @private
     */
    private static IGNORE = {};

    /**
     * @private
     */
    private static _plugins: { [index: string]: any } = {};

    /**
     * @private
     */
    private static _inited = false;

    /**
     * @private
     */
    private _target!: T;

    /**
     * @private
     */
    private _useTicks = false;

    /**
     * @private
     */
    private ignoreGlobalPause = false;

    /**
     * @private
     */
    private loop = false;

    /**
     * @private
     */
    private pluginData: any;

    /**
     * @private
     */
    private _curQueueProps!: Props<T>;

    /**
     * @private
     */
    private _initQueueProps!: Props<T>;

    /**
     * @private
     */
    private _steps!: any[];

    /**
     * @private
     */
    private paused = false;

    /**
     * @private
     */
    private duration = 0;

    /**
     * @private
     */
    private _prevPos = -1;

    /**
     * @private
     */
    private position!: number;

    /**
     * @private
     */
    private _prevPosition = 0;

    /**
     * @private
     */
    private _stepPosition = 0;

    /**
     * @private
     */
    private passive = false;

    /**
     * 激活一个对象，对其添加 Tween 动画
     * @param target {any} 要激活 Tween 的对象
     * @param props {any} 参数，支持loop(循环播放) onChange(变化函数) onChangeObj(变化函数作用域)
     * @param pluginData {any} 暂未实现
     * @param override {boolean} 是否移除对象之前添加的tween，默认值false。
     * 不建议使用，可使用 Tween.removeTweens(target) 代替。
     * @language zh_CN
     */
    public static get<T>(target: T, props?: Props<T>, pluginData: any = null, override = false): Tween<T> {
        if (override) {
            Tween.removeTweens(target);
        }
        return new Tween(target, props, pluginData);
    }

    /**
     * 删除一个对象上的全部 Tween 动画
     * @param target  需要移除 Tween 的对象
     * @language zh_CN
     */
    public static removeTweens(target: any): void {
        if (!target.tween_count) {
            return;
        }
        const tweens: Tween[] = Tween._tweens;
        for (let i = tweens.length - 1; i >= 0; i--) {
            if (tweens[i]._target == target) {
                tweens[i].paused = true;
                tweens.splice(i, 1);
            }
        }
        target.tween_count = 0;
    }

    /**
     * 暂停某个对象的所有 Tween
     * @param target 要暂停 Tween 的对象
     * @language zh_CN
     */
    public static pauseTweens(target: any): void {
        if (!target.tween_count) {
            return;
        }
        const tweens: Tween[] = Tween._tweens;
        for (let i = tweens.length - 1; i >= 0; i--) {
            if (tweens[i]._target == target) {
                tweens[i].paused = true;
            }
        }
    }

    /**
     * 继续播放某个对象的所有缓动
     * @param target 要继续播放 Tween 的对象
     * @language zh_CN
     */
    public static resumeTweens(target: any): void {
        if (!target.tween_count) {
            return;
        }
        const tweens: Tween[] = Tween._tweens;
        for (let i = tweens.length - 1; i >= 0; i--) {
            if (tweens[i]._target == target) {
                tweens[i].paused = false;
            }
        }
    }

    /**
     * @private
     *
     * @param delta
     * @param paused
     */
    static tick(timeStamp: number) {
        const delta = timeStamp - Tween._lastTime;
        Tween._lastTime = timeStamp;

        const tweens: Tween[] = Tween._tweens.concat();
        for (let i = tweens.length - 1; i >= 0; i--) {
            const tween: Tween = tweens[i];
            if (tween.paused) {
                continue;
            }
            tween.$tick(tween._useTicks ? 1 : delta);
        }
    }

    private static _lastTime = 0;

    /**
     * @private
     *
     * @param tween
     * @param value
     */
    private static _register(tween: Tween, value: boolean): void {
        const target: any = tween._target;
        const tweens: Tween[] = Tween._tweens;
        if (value) {
            if (target) {
                target.tween_count = target.tween_count > 0 ? target.tween_count + 1 : 1;
            }
            tweens.push(tween);
            if (!Tween._inited) {
                Tween._lastTime = Time.Instance().passedTime;
                Tween._inited = true;
            }
        } else {
            if (target) {
                target.tween_count--;
            }
            let i = tweens.length;
            while (i--) {
                if (tweens[i] == tween) {
                    tweens.splice(i, 1);
                    return;
                }
            }
        }
    }

    /**
     * 删除所有 Tween
     * @language zh_CN
     */
    public static removeAllTweens(): void {
        const tweens: Tween[] = Tween._tweens;
        for (let i = 0, l = tweens.length; i < l; i++) {
            const tween: Tween = tweens[i];
            tween.paused = true;
            tween._target.tween_count = 0;
        }
        tweens.length = 0;
    }

    /**
     * 创建一个 egret.Tween 对象
     * @private
     */
    constructor(target: T, props?: Props<T>, pluginData?: any) {
        super();
        this.initialize(target, props, pluginData);
    }

    /**
     * @private
     *
     * @param target
     * @param props
     * @param pluginData
     */
    private initialize(target: T, props?: Props<T>, pluginData?: any): void {
        this._target = target;
        if (props) {
            this._useTicks = !!props.useTicks;
            this.ignoreGlobalPause = !!props.ignoreGlobalPause;
            this.loop = !!props.loop;
            props.onChange && this.addEventListener('change', props.onChange, props.onChangeObj);
            if (props.override) {
                Tween.removeTweens(target);
            }
        }

        this.pluginData = pluginData || {};
        this._curQueueProps = {};
        this._initQueueProps = {};
        this._steps = [];
        if (props && props.paused) {
            this.paused = true;
        } else {
            Tween._register(this, true);
        }
        if (props && props.position != null) {
            this.setPosition(props.position, Tween.NONE);
        }
    }

    /**
     * @private
     *
     * @param value
     * @param actionsMode
     * @returns
     */
    public setPosition(value: number, actionsMode = 1): boolean {
        if (value < 0) {
            value = 0;
        }

        //正常化位置
        let t: number = value;
        let end = false;
        if (t >= this.duration) {
            if (this.loop) {
                const newTime = t % this.duration;
                if (t > 0 && newTime === 0) {
                    t = this.duration;
                } else {
                    t = newTime;
                }
            } else {
                t = this.duration;
                end = true;
            }
        }
        if (t == this._prevPos) {
            return end;
        }

        if (end) {
            this.setPaused(true);
        }

        const prevPos = this._prevPos;
        this.position = this._prevPos = t;
        this._prevPosition = value;

        if (this._target) {
            if (this._steps.length > 0) {
                // 找到新的tween
                const l = this._steps.length;
                let stepIndex = -1;
                for (let i = 0; i < l; i++) {
                    if (this._steps[i].type == 'step') {
                        stepIndex = i;
                        if (this._steps[i].t <= t && this._steps[i].t + this._steps[i].d >= t) {
                            break;
                        }
                    }
                }
                for (let i = 0; i < l; i++) {
                    if (this._steps[i].type == 'action') {
                        //执行actions
                        if (actionsMode != 0) {
                            if (this._useTicks) {
                                this._runAction(this._steps[i], t, t);
                            } else if (actionsMode == 1 && t < prevPos) {
                                if (prevPos != this.duration) {
                                    this._runAction(this._steps[i], prevPos, this.duration);
                                }
                                this._runAction(this._steps[i], 0, t, true);
                            } else {
                                this._runAction(this._steps[i], prevPos, t);
                            }
                        }
                    } else if (this._steps[i].type == 'step') {
                        if (stepIndex == i) {
                            const step = this._steps[stepIndex];
                            this._updateTargetProps(step, Math.min((this._stepPosition = t - step.t) / step.d, 1));
                        }
                    }
                }
            }
        }

        this.dispatchEventWith('change');
        return end;
    }

    /**
     * @private
     *
     * @param startPos
     * @param endPos
     * @param includeStart
     */
    private _runAction(action: any, startPos: number, endPos: number, includeStart = false) {
        let sPos: number = startPos;
        let ePos: number = endPos;
        if (startPos > endPos) {
            //把所有的倒置
            sPos = endPos;
            ePos = startPos;
        }
        const pos = action.t;
        if (pos == ePos || (pos > sPos && pos < ePos) || (includeStart && pos == startPos)) {
            action.f.apply(action.o, action.p);
        }
    }

    /**
     * @private
     *
     * @param step
     * @param ratio
     */
    private _updateTargetProps(step: any, ratio: number) {
        let p0, p1, v, v0, v1, arr;
        if (!step && ratio == 1) {
            this.passive = false;
            p0 = p1 = this._curQueueProps;
        } else {
            this.passive = !!step.v;
            //不更新props.
            if (this.passive) {
                return;
            }
            //使用ease
            if (step.e) {
                ratio = step.e(ratio, 0, 1, 1);
            }
            p0 = step.p0;
            p1 = step.p1;
        }

        const initQueueProps = this._initQueueProps as any;

        for (const n in initQueueProps) {
            if ((v0 = p0[n]) == null) {
                p0[n] = v0 = initQueueProps[n];
            }
            if ((v1 = p1[n]) == null) {
                p1[n] = v1 = v0;
            }
            // eslint-disable-next-line space-unary-ops
            if (v0 == v1 || ratio == 0 || ratio == 1 || typeof v0 != 'number') {
                v = ratio == 1 ? v1 : v0;
            } else {
                v = v0 + (v1 - v0) * ratio;
            }

            let ignore = false;
            if ((arr = Tween._plugins[n])) {
                for (let i = 0, l = arr.length; i < l; i++) {
                    const v2: any = arr[i].tween(this, n, v, p0, p1, ratio, !!step && p0 == p1, !step);
                    if (v2 == Tween.IGNORE) {
                        ignore = true;
                    } else {
                        v = v2;
                    }
                }
            }
            if (!ignore) {
                (this._target as any)[n] = v;
            }
        }
    }

    /**
     * 设置是否暂停
     * @param value {boolean} 是否暂停
     * @returns Tween对象本身
     * @language zh_CN
     */
    public setPaused(value: boolean): Tween<T> {
        if (this.paused == value) {
            return this;
        }
        this.paused = value;
        Tween._register(this, !value);
        return this;
    }

    /**
     * @private
     *
     * @param props
     * @returns
     */
    private _cloneProps(props: Props<T>): Props<T> {
        const o: any = {};
        for (const n in props) {
            o[n] = (props as any)[n];
        }
        return o;
    }

    /**
     * @private
     *
     * @param o
     * @returns
     */
    private _addStep(o: any): Tween {
        if (o.d > 0) {
            o.type = 'step';
            this._steps.push(o);
            o.t = this.duration;
            this.duration += o.d;
        }
        return this;
    }

    /**
     * @private
     *
     * @param o
     * @returns
     */
    private _appendQueueProps(o: any): any {
        let arr, oldValue, i, l, injectProps;
        const initQueueProps: any = this._initQueueProps;
        const curQueueProps: any = this._curQueueProps;
        for (const n in o) {
            if (initQueueProps[n] === undefined) {
                oldValue = (this._target as any)[n];
                //设置plugins
                if ((arr = Tween._plugins[n])) {
                    for (i = 0, l = arr.length; i < l; i++) {
                        oldValue = arr[i].init(this, n, oldValue);
                    }
                }
                const v = oldValue === undefined ? null : oldValue;
                initQueueProps[n] = v;
                curQueueProps[n] = v;
            } else {
                oldValue = curQueueProps[n];
            }
        }

        for (const n in o) {
            oldValue = curQueueProps[n];
            if ((arr = Tween._plugins[n])) {
                injectProps = injectProps || {};
                for (i = 0, l = arr.length; i < l; i++) {
                    if (arr[i].step) {
                        arr[i].step(this, n, oldValue, o[n], injectProps);
                    }
                }
            }
            const a = o[n];
            curQueueProps[n] = a;
        }
        if (injectProps) {
            this._appendQueueProps(injectProps);
        }
        return this._curQueueProps;
    }

    /**
     * @private
     *
     * @param o
     * @returns
     */
    private _addAction(o: any): Tween<T> {
        o.t = this.duration;
        o.type = 'action';
        this._steps.push(o);
        return this;
    }

    /**
     * @private
     *
     * @param props
     * @param o
     */
    private _set(props: Props<T>, o: any): void {
        for (const n in props) {
            o[n] = (props as any)[n];
        }
    }

    /**
     * 等待指定毫秒后执行下一个动画
     * @param duration {number} 要等待的时间，以毫秒为单位
     * @param passive {boolean} 等待期间属性是否会更新
     * @returns Tween对象本身
     * @language zh_CN
     */
    public wait(duration: number, passive?: boolean): Tween<T> {
        if (duration == null || duration <= 0) {
            return this;
        }
        const o = this._cloneProps(this._curQueueProps);
        return this._addStep({ d: duration, p0: o, p1: o, v: passive });
    }

    /**
     * 将指定对象的属性修改为指定值
     * @param props {Object} 对象的属性集合
     * @param duration {number} 持续时间
     * @param ease {egret.Ease} 缓动算法
     * @returns {egret.Tween} Tween对象本身
     * @language zh_CN
     */
    to<X extends this>(props: Props<any>, duration?: number, ease?: Function): Tween<T>;

    public to(props: Props<T>, duration?: number, ease?: Function): Tween<T> {
        if (isNaN(duration!) || duration! < 0) {
            duration = 0;
        }
        this._addStep({ d: duration || 0, p0: this._cloneProps(this._curQueueProps), e: ease, p1: this._cloneProps(this._appendQueueProps(props)) });
        //加入一步set，防止游戏极其卡顿时候，to后面的call取到的属性值不对
        return this.set(props);
    }

    /**
     * 执行回调函数
     * @param callback {Function} 回调方法
     * @param thisObj {any} 回调方法this作用域
     * @param params {any[]} 回调方法参数
     * @returns {egret.Tween} Tween对象本身
     * @example
     * <pre>
     *  egret.Tween.get(display).call(function (a:number, b:string) {
     *      console.log("a: " + a); //对应传入的第一个参数 233
     *      console.log("b: " + b); //对应传入的第二个参数 “hello”
     *  }, this, [233, "hello"]);
     * </pre>
     * @language zh_CN
     */
    public call<R extends any[]>(callback: (...args: R) => void, thisObj: any = undefined, params?: R): Tween<T> {
        return this._addAction({ f: callback, p: params ? params : [], o: thisObj ? thisObj : this._target });
    }

    /**
     * Now modify the properties of the specified object to the specified value
     * @param props {Object} Property set of an object
     * @param target The object whose Tween to be resumed
     * @returns {egret.Tween} Tween object itself
     */
    /**
     * 立即将指定对象的属性修改为指定值
     * @param props {Object} 对象的属性集合
     * @param target 要继续播放 Tween 的对象
     * @returns {egret.Tween} Tween对象本身
     */
    public set(props: Props<T>, target?: any): Tween<T> {
        //更新当前数据，保证缓动流畅性
        this._appendQueueProps(props);
        return this._addAction({ f: this._set, o: this, p: [props, target ? target : this._target] });
    }

    /**
     * 执行
     * @param tween {egret.Tween} 需要操作的 Tween 对象，默认this
     * @returns {egret.Tween} Tween对象本身
     * @language zh_CN
     */
    public play(tween?: Tween): Tween {
        if (!tween) {
            tween = this;
        }
        return this.call(tween.setPaused, tween, [false]);
    }

    /**
     * 暂停
     * @param tween {egret.Tween} 需要操作的 Tween 对象，默认this
     * @returns {egret.Tween} Tween对象本身
     * @language zh_CN
     */
    public pause(tween?: Tween): Tween {
        if (!tween) {
            tween = this;
        }
        return this.call(tween.setPaused, tween, [true]);
    }

    /**
     * @method egret.Tween#tick
     * @param delta {number}
     * @private
     */
    public $tick(delta: number): void {
        if (this.paused) {
            return;
        }
        this.setPosition(this._prevPosition + delta);
    }
}
