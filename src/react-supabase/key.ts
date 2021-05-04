let i = 0;

export class Key {
  static getKey() {
    i++;
    return `${i}`;
  }

  static reset() {
    i = 0;
  }
}
