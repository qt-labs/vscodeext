// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

package qmltrace

import (
	"bytes"
	"compress/zlib"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"unicode/utf16"
)

type QtDataDecoder struct {
	reader io.Reader
	err    error
}

func (d *QtDataDecoder) Bytes() []byte {
	if d.err != nil {
		return nil
	}

	var data []byte
	data, d.err = readQByteArray(d.reader)
	return data
}

func (d *QtDataDecoder) BytesUncompressed() []byte {
	if d.err != nil {
		return nil
	}

	var data []byte
	var uncompressed []byte
	data, d.err = readQByteArray(d.reader)
	if d.err != nil {
		return nil
	}

	uncompressed, d.err = qUncompress(data)
	return uncompressed
}

func (d *QtDataDecoder) String() string {
	if d.err != nil {
		return ""
	}

	var s string
	s, d.err = readQString(d.reader)
	return s
}

func (d *QtDataDecoder) Int8() int8 {
	if d.err != nil {
		return 0
	}

	var v int8
	v, d.err = readNumber[int8](d.reader)
	return v
}

func (d *QtDataDecoder) Int16() int16 {
	if d.err != nil {
		return 0
	}

	var v int16
	v, d.err = readNumber[int16](d.reader)
	return v
}

func (d *QtDataDecoder) Int32() int32 {
	if d.err != nil {
		return 0
	}

	var v int32
	v, d.err = readNumber[int32](d.reader)
	return v
}

func (d *QtDataDecoder) Int64() int64 {
	if d.err != nil {
		return 0
	}

	var v int64
	v, d.err = readNumber[int64](d.reader)
	return v
}

func (d *QtDataDecoder) Int64ByQmlSizeCode(sizeCode byte) int64 {
	if d.err != nil {
		return 0
	}

	// qmlevent.cpp
	//
	// enum SerializationType {
	// 	OneByte    = 0,
	// 	TwoByte    = 1,
	// 	FourByte   = 2,
	// 	EightByte  = 3,
	// 	TypeMask   = 0x3
	// };

	byteWidth := 1 << int(sizeCode)

	var v int64
	v, d.err = readIntByByteWidth[int64](d.reader, byteWidth)
	return v
}

func (d *QtDataDecoder) Uint8() uint8 {
	if d.err != nil {
		return 0
	}

	var v uint8
	v, d.err = readNumber[uint8](d.reader)
	return v
}

// helpers
type Number interface {
	int8 | int16 | int32 | int64 | uint8 | uint16 | uint32 | uint64
}

func readNumber[T Number](r io.Reader) (T, error) {
	var data T
	err := binary.Read(r, binary.BigEndian, &data)

	return data, err
}

func readIntByByteWidth[T Number](r io.Reader, byteWidth int) (T, error) {
	switch byteWidth {
	case 1:
		v, err := readNumber[int8](r)
		return T(v), err

	case 2:
		v, err := readNumber[int16](r)
		return T(v), err

	case 4:
		v, err := readNumber[int32](r)
		return T(v), err

	case 8:
		v, err := readNumber[int64](r)
		return T(v), err

	default:
		var zero T
		err := fmt.Errorf("Unsupported byte width: %d", byteWidth)
		fmt.Println(err)
		return zero, err
	}
}

func readQString(r io.Reader) (string, error) {
	numBytes, err := readNumber[uint32](r)
	if err != nil {
		fmt.Println(1, numBytes, err)
		return "", err
	}

	if numBytes == 0xffffffff || numBytes == 0 {
		return "", nil
	}

	rawBytes := make([]byte, numBytes)
	if _, err := io.ReadFull(r, rawBytes); err != nil {
		fmt.Println(2, numBytes, err)
		return "", err
	}

	// TODO: check if the charCount is too big or not,
	// to prevent memory exhaust or something
	numChars := numBytes / 2
	utf16Chars := make([]uint16, numChars)
	for i := range utf16Chars {
		utf16Chars[i] = binary.BigEndian.Uint16(rawBytes[i*2 : i*2+2])
	}

	// convert utf-16 to go string (utf-8)
	return string(utf16.Decode(utf16Chars)), nil
}

func readQByteArray(r io.Reader) ([]byte, error) {
	var length uint32
	if err := binary.Read(r, binary.BigEndian, &length); err != nil {
		return nil, err
	}

	if length == 0xFFFFFFFF {
		// in case of null QByteArray
		return nil, nil
	}

	data := make([]byte, length)
	_, err := io.ReadFull(r, data)
	return data, err
}

func qUncompress(data []byte) ([]byte, error) {
	if len(data) < 4 {
		return nil, errors.New("data too short")
	}

	b := bytes.NewReader(data[4:]) // skip first 4 bytes
	r, err := zlib.NewReader(b)
	if err != nil {
		return nil, err
	}

	defer r.Close()
	return io.ReadAll(r)
}
