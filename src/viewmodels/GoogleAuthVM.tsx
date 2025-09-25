import React, { createContext, useContext, useState } from 'react';
// import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

// WebBrowser.maybeCompleteAuthSession();

const GoogleAuthContext = createContext<any>(null);

export const GoogleAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    // androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    // expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      setUser(authentication);
    }
  }, [response]);

  return (
    <GoogleAuthContext.Provider value={{ user, promptAsync }}>
      {children}
    </GoogleAuthContext.Provider>
  );
};

export const useGoogleAuth = () => useContext(GoogleAuthContext);
