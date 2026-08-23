import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser,
  onAuthStateChanged,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { apiFetch } from '../apiClient';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  subscriptionTier?: 'free' | 'pro';
  subscriptionPeriod?: 'month' | 'year' | 'none';
  trialExpires?: string;
  subscriptionId?: string;
  createdAt?: string;
  gmailConnected?: boolean;
  gmailEmail?: string | null;
  outlookConnected?: boolean;
  outlookEmail?: string | null;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  signInAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  gmailAccessToken: string | null;
  connectGmail: () => Promise<void>;
  disconnectGmail: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const initializeNewUserProfile = async (
  uid: string,
  email: string,
  displayName: string,
  photoURL: string
) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      return;
    }

    await setDoc(userRef, {
      uid,
      email: email || '',
      displayName: displayName || 'Outreach Member',
      photoURL: photoURL || '',
      subscriptionTier: 'free',
      subscriptionPeriod: 'none',
      subscriptionId: '',
      trialExpires: '',
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn("Failed to initialize the user profile:", err);
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (currentUser) {
        setUser(currentUser);
        const userRef = doc(db, 'users', currentUser.uid);

        // Fail closed to the free plan until the server-owned profile is loaded.
        setProfile({
          uid: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || 'Outreach Member',
          photoURL: currentUser.photoURL || '',
          subscriptionTier: 'free',
          subscriptionPeriod: 'none',
          trialExpires: '',
          subscriptionId: ''
        });

        // Initialize an empty profile only if it does not exist already.
        await initializeNewUserProfile(
          currentUser.uid,
          currentUser.email || '',
          currentUser.displayName || '',
          currentUser.photoURL || ''
        );

        // Setup real-time listener for current profile parameters
        unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const resolvedTier = data.subscriptionTier === 'pro' ? 'pro' : 'free';
            setProfile({
              uid: data.uid,
              email: data.email,
              displayName: data.displayName,
              photoURL: data.photoURL,
              subscriptionTier: resolvedTier as 'free' | 'pro',
              subscriptionPeriod: data.subscriptionPeriod || 'none',
              trialExpires: data.trialExpires || '',
              subscriptionId: data.subscriptionId || '',
              createdAt: data.createdAt,
              gmailConnected: data.gmailConnected || false,
              gmailEmail: data.gmailEmail || null,
              outlookConnected: data.outlookConnected || false,
              outlookEmail: data.outlookEmail || null
            });
          } else {
            // DB record is not seeded yet; keep the UI on the safe free plan.
            setProfile({
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || 'Outreach Member',
              photoURL: currentUser.photoURL || '',
              subscriptionTier: 'free',
              subscriptionPeriod: 'none',
              trialExpires: '',
              subscriptionId: ''
            });
          }
          setLoading(false);
        }, (err) => {
          console.error("User profile database sync error (permission denied or connection missing):", err);
          // Standard structural fallback for profiles; never trust cached subscription state.
          setProfile({
            uid: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || 'Outreach Member',
            subscriptionTier: 'free',
            subscriptionPeriod: 'none',
            trialExpires: '',
            subscriptionId: ''
          });
          setLoading(false);
        });

      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error('Email login error:', error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const createdUser = userCredential.user;
      
      // Update display name
      await updateProfile(createdUser, {
        displayName: name
      });

      // Initialize an empty workspace profile.
      await initializeNewUserProfile(createdUser.uid, createdUser.email || '', name, '');
    } catch (error) {
      console.error('Email sign up error:', error);
      throw error;
    }
  };

  const signInAsGuest = async () => {
    try {
      try {
        const userCredential = await signInAnonymously(auth);
        const guestUser = userCredential.user;
        await initializeNewUserProfile(guestUser.uid, '', 'Guest User', '');
      } catch (anonErr) {
        throw new Error('Guest access is unavailable. Please use a personal account.');
      }
    } catch (error) {
      console.error('Guest sign-in error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const [gmailAccessToken, setGmailAccessToken] = useState<string | null>(null);

  const connectGmail = async () => {
    if (!user) return;
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/gmail.send');
    provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
    
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      const verifiedEmail = result.user.email || user.email || '';
      if (!token) {
        throw new Error("No Google credentials token returned.");
      }
      
      setGmailAccessToken(token);

      // Perform secure encryption storage on backend proxy
      const response = await apiFetch('/api/gmail/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: verifiedEmail,
          token: token
        })
      });

      if (!response.ok) {
        throw new Error("Local backend rejected securing encrypted refresh secrets.");
      }
      
      // Update local profile document flag directly to trigger realtime sync
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        gmailConnected: true,
        gmailEmail: verifiedEmail
      }, { merge: true });

    } catch (err) {
      console.error("connectGmail action crash:", err);
      throw err;
    }
  };

  const disconnectGmail = async () => {
    if (!user) return;
    try {
      setGmailAccessToken(null);
      const response = await apiFetch('/api/gmail/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        throw new Error('Gmail credentials could not be disconnected.');
      }
    } catch (err) {
      console.error("disconnectGmail action crash:", err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      signInWithGoogle, 
      signInWithEmail, 
      signUpWithEmail, 
      signInAsGuest,
      logout,
      gmailAccessToken,
      connectGmail,
      disconnectGmail
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
};
