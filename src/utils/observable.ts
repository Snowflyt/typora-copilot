/**
 * A lightweight observable implementation.
 */
export class Observable<T> {
  private observers: Array<(value: T) => void> = [];

  subscribe(observer: (value: T) => void): () => void {
    this.observers.push(observer);
    return () => {
      this.observers = this.observers.filter((o) => o !== observer);
    };
  }

  subscribeOnce(observer: (value: T) => void): void {
    const unsubscribe = this.subscribe((value) => {
      unsubscribe();
      observer(value);
    });
  }

  next(value: T): void {
    this.observers.forEach((observer) => observer(value));
  }
}
