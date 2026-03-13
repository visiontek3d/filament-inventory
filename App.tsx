import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './src/types';
import FilamentListScreen from './src/screens/FilamentListScreen';
import FilamentDetailScreen from './src/screens/FilamentDetailScreen';
import AddEditFilamentScreen from './src/screens/AddEditFilamentScreen';
import AddEditRollScreen from './src/screens/AddEditRollScreen';
import ScanScreen from './src/screens/ScanScreen';
import BulkImportScreen from './src/screens/BulkImportScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
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
        <Stack.Screen
          name="FilamentList"
          component={FilamentListScreen}
          options={{ title: 'Filament Inventory' }}
        />
        <Stack.Screen
          name="FilamentDetail"
          component={FilamentDetailScreen}
          options={{ title: '' }}
        />
        <Stack.Screen
          name="AddEditFilament"
          component={AddEditFilamentScreen}
          options={{ title: 'Add Filament' }}
        />
        <Stack.Screen
          name="AddEditRoll"
          component={AddEditRollScreen}
          options={{ title: 'Add Roll' }}
        />
        <Stack.Screen
          name="Scan"
          component={ScanScreen}
          options={{ title: 'Scan Barcode', headerShown: false }}
        />
        <Stack.Screen
          name="BulkImport"
          component={BulkImportScreen}
          options={{ title: 'Import CSV' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: 'Settings' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
