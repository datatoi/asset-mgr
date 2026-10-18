import React from 'react';
import { AutoComplete, Input } from 'antd';

interface SizeInputProps {
  value?: string;
  onChange?: (value: string) => void;
  sizes?: string[];
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

// Free-text size field that suggests the category's size template.
const SizeInput: React.FC<SizeInputProps> = ({ value, onChange, sizes = [], placeholder = 'e.g. M, 42, 175cm', disabled, style }) => (
  <AutoComplete
    value={value}
    onChange={onChange}
    disabled={disabled}
    style={style}
    options={sizes.map(s => ({ value: s }))}
    filterOption={(input, option) => String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())}
  >
    <Input placeholder={placeholder} maxLength={50} />
  </AutoComplete>
);

export default SizeInput;
