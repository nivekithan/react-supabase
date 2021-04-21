let i = 0;

export class Key {
  static getUniqueKey() {
    i++;
    return `${i}`;
  }
}
