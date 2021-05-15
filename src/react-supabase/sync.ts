class Empty {
  constructor() {
    // DO NOTHING
  }
}

export class Sync {
  private __current: Empty | number = new Empty();

  constructor(sync: number) {
    if (this.__current instanceof Empty) {
      this.__current = sync;
    } else {
      // DO NOTHING
    }
  }

  get current() {
    if (this.__current instanceof Empty) {
      throw new Error("Initialize the sync before getting the value of current");
    } else {
      return this.__current;
    }
  }

  set current(sync: number) {
    this.__current = sync;
  }
}
