// Class representing a basic FIFO Queue
export class Queue<T> {
    private items: T[] = [];

    enqueue(item: T) {
        this.items.push(item);
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