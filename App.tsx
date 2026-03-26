import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import { getSetting } from './src/db/database';
import { migrateToSupabase } from './src/migration/migrateToSupabase';
import { RootStackParamList } from './src/types';
import AuthScreen from './src/screens/AuthScreen';
import FilamentListScreen from './src/screens/FilamentListScreen';
import FilamentDetailScreen from './src/screens/FilamentDetailScreen';
import AddEditFilamentScreen from './src/screens/AddEditFilamentScreen';
import AddEditRollScreen from './src/screens/AddEditRollScreen';
import ScanScreen from './src/screens/ScanScreen';
import BulkImportScreen from './src/screens/BulkImportScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Run migration once after first sign-in
  useEffect(() => {
    if (!session?.user?.id) return;
    if (getSetting('supabase_migrated', '0') === '1') return;

    setMigrating(true);
    migrateToSupabase(session.user.id, setMigrationProgress)
      .catch(console.warn)
      .finally(() => setMigrating(false));
  }, [session?.user?.id]);

  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3367d6" />
      </View>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (migrating) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3367d6" />
        <Text style={styles.migratingText}>Syncing your data…</Text>
        {migrationProgress ? <Text style={styles.migratingProgress}>{migrationProgress}</Text> : null}
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#fff' },
          headerTintColor: '#3367d6',
          headerTitleStyle: { fontWeight: '700', color: '#1a1a1a' },
        }}
      >
        <Stack.Screen name="FilamentList"   component={FilamentListScreen}   options={{ title: 'Filament Inventory' }} />
        <Stack.Screen name="FilamentDetail" component={FilamentDetailScreen} options={{ title: '' }} />
        <Stack.Screen name="AddEditFilament" component={AddEditFilamentScreen} options={{ title: 'Add Filament' }} />
        <Stack.Screen name="AddEditRoll"    component={AddEditRollScreen}    options={{ title: 'Add Roll' }} />
        <Stack.Screen name="Scan"           component={ScanScreen}           options={{ title: 'Scan Barcode', headerShown: false }} />
        <Stack.Screen name="BulkImport"     component={BulkImportScreen}     options={{ title: 'Import CSV' }} />
        <Stack.Screen name="Settings"       component={SettingsScreen}       options={{ title: 'Settings' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5', gap: 16 },
  migratingText: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  migratingProgress: { fontSize: 13, color: '#888' },
});
