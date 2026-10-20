import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useAuth } from '@/lib/auth';
import { getProfile, isAdminRole } from '@/lib/profiles';

export default function TabLayout() {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);

  useEffect(() => {
    let active = true;

    if (loading) return;
    if (!user) {
      setIsAdmin(false);
      setIsTeacher(false);
      return;
    }

    getProfile(user.id).then((profile) => {
      if (active) {
        setIsAdmin(isAdminRole(profile?.role));
        setIsTeacher(profile?.role === 'teacher');
      }
    });

    return () => {
      active = false;
    };
  }, [loading, user]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#ffd33d',
        headerStyle: { backgroundColor: '#25292e' },
        headerShadowVisible: false,
        headerTintColor: '#fff',
        tabBarStyle: { backgroundColor: '#25292e' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home-sharp' : 'home-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          href: isAdmin ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'qr-code' : 'qr-code-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'time' : 'time-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="teacher"
        options={{
          title: 'Teacher',
          href: isTeacher ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'clipboard' : 'clipboard-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />

    </Tabs>
  );
}
