import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Alert, Image, ActivityIndicator } from 'react-native';
import NfcManager, { NfcEvents } from 'react-native-nfc-manager';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../web/src/lib/firebase';

export default function App() {
  const [hasNfc, setHasNfc] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [item, setItem] = useState<any>(null);

  useEffect(() => {
    async function checkNfc() {
      const supported = await NfcManager.isSupported();
      setHasNfc(supported);
      if (supported) {
        await NfcManager.start();
      }
    }
    checkNfc();
  }, []);

  const readTag = async () => {
    setLoading(true);
    try {
      await NfcManager.requestTechnology(NfcEvents.DiscoverTag);
      const tag = await NfcManager.getTag();
      
      if (tag?.id) {
        const itemId = tag.id; 
        const itemDoc = await getDoc(doc(db, 'items', itemId));
        
        if (itemDoc.exists()) {
          setItem({ id: itemDoc.id, ...itemDoc.data() });
        } else {
          Alert.alert('Not Found', 'This tag is not registered in the system.');
        }
      }
    } catch (ex) {
      console.warn(ex);
    } finally {
      NfcManager.cancelTechnologyRequest();
      setLoading(false);
    }
  };

  if (hasNfc === null) return <View style={styles.container}><Text>Checking NFC...</Text></View>;
  if (!hasNfc) return <View style={styles.container}><Text>NFC not supported on this device</Text></View>;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Dress Asset Scanner</Text>
      
      {loading ? (
        <ActivityIndicator size="large" color="#1890ff" />
      ) : item ? (
        <View style={styles.itemCard}>
          <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
          <Text style={styles.itemName}>Size: {item.size}</Text>
          <Text style={styles.itemHolder}>Current Holder: {item.holderId}</Text>
          
          <TouchableOpacity 
            style={[styles.button, { marginTop: 20 }]} 
            onPress={() => Alert.alert('Request Sent', 'Transfer request has been created.')}
          >
            <Text style={styles.buttonText}>REQUEST TRANSFER</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => setItem(null)} style={{ marginTop: 20 }}>
            <Text style={{ color: '#1890ff' }}>Clear</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.label}>Ready to scan</Text>
          <Text style={styles.value}>Tap a garment's NFC tag</Text>
        </View>
      )}
      
      {!item && !loading && (
        <TouchableOpacity style={styles.button} onPress={readTag}>
          <Text style={styles.buttonText}>SCAN NOW</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 40 },
  card: { padding: 20, borderRadius: 10, backgroundColor: '#f0f0f0', width: '80%', marginBottom: 40, alignItems: 'center' },
  itemCard: { padding: 20, borderRadius: 10, backgroundColor: '#fff', width: '90%', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  itemImage: { width: 200, height: 200, borderRadius: 10, marginBottom: 20 },
  itemName: { fontSize: 20, fontWeight: 'bold' },
  itemHolder: { fontSize: 16, color: '#666', marginTop: 5 },
  label: { color: '#666', marginBottom: 5 },
  value: { fontSize: 18, fontWeight: '500' },
  button: { 
    backgroundColor: '#1890ff', 
    paddingVertical: 20, 
    paddingHorizontal: 40, 
    borderRadius: 50 
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 18 }
});