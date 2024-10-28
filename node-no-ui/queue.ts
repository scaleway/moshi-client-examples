import { EventEmitter } from "events";

// Class representing a basic FIFO Queue
export class Queue<T> extends EventEmitter {
    private items: T[] = [];

    enqueue(item: T) {
        this.items.push(item);
        this.emit('enqueue', item);
    }

    dequeue(): T | undefined {
        return this.items.shift();
    }

    get length(): number {
        return this.items.length;
    }

    isEmpty(): boolean {
        return this.length === 0;
    }
}