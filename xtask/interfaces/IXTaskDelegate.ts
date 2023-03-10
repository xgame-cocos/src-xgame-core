/*************************************************
/* @author : rontian
/* @email  : i@ronpad.com
/* @date   : 2021-08-20
*************************************************/

import { IXTask } from './IXTask';

export const IXTaskDelegate = Symbol.for('IXTaskDelegate');
export interface IXTaskDelegate {
    initialize(task: IXTask): void;
    validate(task: IXTask): boolean;
    execute(task: IXTask): Promise<void>;
    update(task: IXTask): void;
    selfComplete(task: IXTask): void;
    complete(task: IXTask): void;
    failure(task: IXTask): void;
    reset(task: IXTask): void;
}
