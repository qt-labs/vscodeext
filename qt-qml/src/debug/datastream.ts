// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

// Replacement of QDataStream
export class DataStream {
  private _data = Buffer.alloc(0);
  private readOffset = 0;
  private writeOffset = 0;

  constructor(data?: Buffer) {
    if (data) {
      this.data = data;
    } else {
      this.data = Buffer.alloc(0);
    }
  }
  get data() {
    return this._data.subarray(0, this.writeOffset);
  }
  set data(data: Buffer) {
    this._data = data;
    this.writeOffset = 0;
    this.readOffset = 0;
  }
  writeInt8(value: number) {
    const newValueSize = 1;
    this.ensureCapacity(this.writeOffset + newValueSize);
    this._data.writeInt8(value, this.writeOffset);
    this.writeOffset += newValueSize;
  }
  writeInt16LE(value: number) {
    const newValueSize = 2;
    this.ensureCapacity(this.writeOffset + newValueSize);
    this._data.writeInt16LE(value, this.writeOffset);
    this.writeOffset += newValueSize;
  }
  writeInt16BE(value: number) {
    const newValueSize = 2;
    this.ensureCapacity(this.writeOffset + newValueSize);
    this._data.writeInt16BE(value, this.writeOffset);
    this.writeOffset += newValueSize;
  }
  writeInt32LE(value: number) {
    const newValueSize = 4;
    this.ensureCapacity(this.writeOffset + newValueSize);
    this._data.writeInt32LE(value, this.writeOffset);
    this.writeOffset += newValueSize;
  }
  writeUInt32LE(value: number) {
    const newValueSize = 4;
    this.ensureCapacity(this.writeOffset + newValueSize);
    this._data.writeUInt32LE(value, this.writeOffset);
    this.writeOffset += newValueSize;
  }
  writeInt32BE(value: number) {
    const newValueSize = 4;
    this.ensureCapacity(this.writeOffset + newValueSize);
    this._data.writeInt32BE(value, this.writeOffset);
    this.writeOffset += newValueSize;
  }
  writeUInt32BE(value: number) {
    const newValueSize = 4;
    this.ensureCapacity(this.writeOffset + newValueSize);
    this._data.writeUInt32BE(value, this.writeOffset);
    this.writeOffset += newValueSize;
  }
  writeInt64LE(value: bigint) {
    const newValueSize = 8;
    this.ensureCapacity(this.writeOffset + newValueSize);
    this._data.writeBigInt64LE(value, this.writeOffset);
    this.writeOffset += newValueSize;
  }
  writeInt64BE(value: bigint) {
    const newValueSize = 8;
    this.ensureCapacity(this.writeOffset + newValueSize);
    this._data.writeBigInt64BE(value, this.writeOffset);
    this.writeOffset += newValueSize;
  }
  writeFloatLE(value: number) {
    const newValueSize = 4;
    this.ensureCapacity(this.writeOffset + newValueSize);
    this._data.writeFloatLE(value, this.writeOffset);
    this.writeOffset += newValueSize;
  }
  writeFloatBE(value: number) {
    const newValueSize = 4;
    this.ensureCapacity(this.writeOffset + newValueSize);
    this._data.writeFloatBE(value, this.writeOffset);
    this.writeOffset += newValueSize;
  }
  writeDoubleLE(value: number) {
    const newValueSize = 8;
    this.ensureCapacity(this.writeOffset + newValueSize);
    this._data.writeDoubleLE(value, this.writeOffset);
    this.writeOffset += newValueSize;
  }
  writeDoubleBE(value: number) {
    const newValueSize = 8;
    this.ensureCapacity(this.writeOffset + newValueSize);
    this._data.writeDoubleBE(value, this.writeOffset);
    this.writeOffset += newValueSize;
  }
  writeStringUTF8(value: string) {
    if (value === '') {
      this.writeUInt32BE(0xffffffff);
    }
    const newValueSize = Buffer.byteLength(value, 'utf8');
    this.ensureCapacity(this.writeOffset + newValueSize + 4);
    this.writeUInt32BE(newValueSize);
    this._data.write(value, this.writeOffset, 'utf8');
    this.writeOffset += newValueSize;
  }
  writeBoolean(value: boolean) {
    this.writeInt8(value ? 1 : 0);
  }
  writeJsonUTF8(value: object) {
    const str = JSON.stringify(value);
    if (str === '') {
      this.writeStringUTF8('');
      return;
    }
    this.writeStringUTF8(str);
  }
  getSize(): number {
    return this.writeOffset;
  }
  writeSubDataStream(subPacket: DataStream) {
    this.ensureCapacity(this.writeOffset + subPacket.getSize() + 4);
    this.writeUInt32BE(subPacket.getSize());
    subPacket.data.copy(this._data, this.writeOffset);
    this.writeOffset += subPacket.getSize();
  }
  writeBuffer(buffer: Buffer) {
    this.ensureCapacity(this.writeOffset + buffer.byteLength);
    buffer.copy(this._data, this.writeOffset);
    this.writeOffset += buffer.byteLength;
  }

  writeStringUTF16(value: string) {
    const newValueSize = Buffer.byteLength(value, 'ucs-2');
    this.ensureCapacity(this.writeOffset + newValueSize + 4);
    this.writeUInt32BE(newValueSize);
    const stringBuffer = Buffer.from(value, 'ucs-2').swap16();
    stringBuffer.copy(this._data, this.writeOffset);
    this.writeOffset += newValueSize;
  }

  writeArray<T>(container: T[], writeFunc: (value: T) => void) {
    this.writeUInt32BE(container.length);
    for (const key of container) {
      writeFunc.call(this, key);
    }
  }
  readInt8(): number {
    const value = this._data.readInt8(this.readOffset);
    this.readOffset += 1;
    return value;
  }
  readInt16LE(): number {
    const value = this._data.readInt16LE(this.readOffset);
    this.readOffset += 2;
    return value;
  }
  readInt16BE(): number {
    const value = this._data.readInt16BE(this.readOffset);
    this.readOffset += 2;
    return value;
  }
  readInt32LE(): number {
    const value = this._data.readInt32LE(this.readOffset);
    this.readOffset += 4;
    return value;
  }
  atEnd(): boolean {
    return this.readOffset >= this._data.byteLength;
  }
  readInt32BE(): number {
    const value = this._data.readInt32BE(this.readOffset);
    this.readOffset += 4;
    return value;
  }
  readUInt32LE(): number {
    const value = this._data.readUInt32LE(this.readOffset);
    this.readOffset += 4;
    return value;
  }
  readUInt32BE(): number {
    const value = this._data.readUInt32BE(this.readOffset);
    this.readOffset += 4;
    return value;
  }
  readInt64LE(): bigint {
    const value = this._data.readBigInt64LE(this.readOffset);
    this.readOffset += 8;
    return value;
  }
  readInt64BE(): bigint {
    const value = this._data.readBigInt64BE(this.readOffset);
    this.readOffset += 8;
    return value;
  }
  readFloatLE(): number {
    const value = this._data.readFloatLE(this.readOffset);
    this.readOffset += 4;
    return value;
  }
  readFloatBE(): number {
    const value = this._data.readFloatBE(this.readOffset);
    this.readOffset += 4;
    return value;
  }
  readDoubleLE(): number {
    const value = this._data.readDoubleLE(this.readOffset);
    this.readOffset += 8;
    return value;
  }
  readArray<ValueType>(readFunc: () => ValueType): ValueType[] {
    const length = this.readUInt32BE();
    const values = new Array<ValueType>();
    for (let i = 0; i < length; i++) {
      values.push(readFunc.call(this));
    }
    return values;
  }
  readArrayString(): string[] {
    return this.readArray(() => this.readStringUTF16LE());
  }
  readArrayDouble(): number[] {
    return this.readArray(() => this.readDoubleLE());
  }
  readDoubleBE(): number {
    const value = this._data.readDoubleBE(this.readOffset);
    this.readOffset += 8;
    return value;
  }
  readStringUTF8(): string {
    const length = this.readUInt32BE();
    if (length === 0xffffffff) {
      return '';
    }
    const value = this._data.toString(
      'utf8',
      this.readOffset,
      this.readOffset + length
    );
    this.readOffset += length;
    return value;
  }
  readStringUTF16LE(): string {
    const length = this.readUInt32BE();
    if (length === 0xffffffff) {
      return '';
    }
    const valueBuffer = this._data.subarray(
      this.readOffset,
      this.readOffset + length
    );
    const value = valueBuffer.swap16().toString('ucs-2');
    this.readOffset += length;
    return value;
  }
  readStringUTF16BE(): string {
    const length = this.readUInt32BE();
    if (length === 0xffffffff) {
      return '';
    }
    const bytesLen = length * 2;
    const value = this._data.toString(
      'ucs-2',
      this.readOffset,
      this.readOffset + bytesLen
    );
    this.readOffset += length;
    return value;
  }
  readJsonUTF8(): object {
    const str = this.readStringUTF8();
    if (str === '') {
      return {};
    }
    return JSON.parse(str) as object;
  }
  readSubDataStream(): DataStream {
    const size = this.readUInt32BE();
    const subPacket = new DataStream(
      this._data.subarray(this.readOffset, this.readOffset + size)
    );
    this.readOffset += size;
    return subPacket;
  }
  resize(newSize: number) {
    const newData = Buffer.alloc(newSize);
    this._data.copy(newData);
    this._data = newData;
  }
  ensureCapacity(capacity: number) {
    const increaseFactor = 2;
    if (this._data.byteLength === 0) {
      this.resize(10);
    }
    if (this._data.byteLength < capacity) {
      let newSize = this._data.byteLength * increaseFactor;
      while (newSize < capacity) {
        newSize *= increaseFactor;
      }
      this.resize(newSize);
    }
  }
}
