import React, { useState } from 'react';
import { Upload, message } from 'antd';
import { LoadingOutlined, PlusOutlined } from '@ant-design/icons';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

interface ImageUploadProps {
  value?: string;
  onChange?: (url: string) => void;
  folder: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ value, onChange, folder }) => {
  const [loading, setLoading] = useState(false);

  const handleChange = async (info: any) => {
    if (info.file.status === 'uploading') {
      setLoading(true);
      return;
    }
    
    try {
      const file = info.file.originFileObj;
      const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      
      setLoading(false);
      if (onChange) onChange(url);
      message.success('Image uploaded successfully');
    } catch (error) {
      setLoading(false);
      message.error('Upload failed');
      console.error(error);
    }
  };

  const uploadButton = (
    <div>
      {loading ? <LoadingOutlined /> : <PlusOutlined />}
      <div style={{ marginTop: 8 }}>Upload</div>
    </div>
  );

  return (
    <Upload
      name="avatar"
      listType="picture-card"
      className="avatar-uploader"
      showUploadList={false}
      customRequest={({ onSuccess }: any) => setTimeout(() => onSuccess("ok"), 0)}
      onChange={handleChange}
    >
      {value ? <img src={value} alt="avatar" style={{ width: '100%' }} /> : uploadButton}
    </Upload>
  );
};

export default ImageUpload;