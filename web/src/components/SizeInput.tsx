import React from 'react';
import { AutoComplete, Input } from 'antd';

interface SizeInputProps {
  id?: string;
  value?: string;
  onChange?: (value: string) => void;
  sizes?: string[];
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

// Free-text size field that suggests the category's size template.
const SizeInput: React.FC<SizeInputProps> = ({ id, value, onChange, sizes = [], placeholder = 'e.g. M, 42, 175cm', disabled, style }) => (
  <AutoComplete
    value={value}
    onChange={onChange}
    disabled={disabled}
    style={style}
    options={sizes.map(s => ({ value: s }))}
    // An exact template value shows the whole list so another size can be picked.
    filterOption={(input, option) => sizes.includes(input) || String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())}
  >
    <Input id={id} placeholder={placeholder} maxLength={50} />
  </AutoComplete>
);

export default SizeInput;
