import React, { useState } from 'react';
import { Upload, message, type UploadProps } from 'antd';
import { LoadingOutlined, PlusOutlined } from '@ant-design/icons';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { call } from '../lib/api';

interface ImageUploadProps {
  value?: string;
  onChange?: (url: string) => void | Promise<void>;
  folder: string;
  disabled?: boolean;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ value, onChange, folder, disabled }) => {
  const [loading, setLoading] = useState(false);
  const upload: UploadProps['customRequest'] = async ({ file, onSuccess, onError }) => {
    setLoading(true);
    try {
      if (typeof file === 'string') throw new Error('Select an image file.');
      const groupPath = /^subscriptions\/[^/]+\/groups\/([^/]+)\/(items|products)$/.exec(folder);
      const uploadFolder = groupPath ? (await call<{ folder: string }>('prepareImageUpload', { groupId: groupPath[1], kind: groupPath[2] })).folder : folder;
      const storageRef = ref(storage, `${uploadFolder}/${crypto.randomUUID()}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      await onChange?.(url);
      onSuccess?.(url);
      message.success('Image saved');
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      onError?.(failure);
      message.error(failure.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Upload
      listType="picture-card"
      showUploadList={false}
      disabled={disabled || loading}
      accept="image/jpeg,image/png,image/webp,image/gif"
      beforeUpload={file => {
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) {
          message.error('Choose a JPG, PNG, WebP or GIF image up to 5 MB.');
          return Upload.LIST_IGNORE;
        }
        return true;
      }}
      customRequest={upload}
    >
      {loading ? <LoadingOutlined /> : value ? <img src={value} alt="Uploaded image" style={{ width: '100%' }} /> : (
        <div><PlusOutlined /><div style={{ marginTop: 8 }}>{disabled ? 'Select group first' : 'Upload'}</div></div>
      )}
    </Upload>
  );
};

export default ImageUpload;
