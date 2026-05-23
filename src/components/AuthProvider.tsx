import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser,
  onAuthStateChanged,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { PREPOPULATED_LEADS } from '../seedData';

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
  logout: () => Promise<void>;
  updateUserSubscription: (
    tier: 'free' | 'pro', 
    period: 'month' | 'year' | 'none', 
    trialExpires?: string, 
    subId?: string
  ) => Promise<void>;
  gmailAccessToken: string | null;
  connectGmail: () => Promise<void>;
  disconnectGmail: () => Promise<void>;
  connectOutlook: (email: string) => Promise<void>;
  disconnectOutlook: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const initializeNewUserProfileAndLeads = async (
  uid: string,
  email: string,
  displayName: string,
  photoURL: string
) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      return; // Prevents overwriting existing profiles
    }

    const batch = writeBatch(db);
    batch.set(userRef, {
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

    for (const item of PREPOPULATED_LEADS) {
      const seedId = `seed_${item.id}_${uid}`;
      const seedLeadRef = doc(db, 'leads', seedId);
      batch.set(seedLeadRef, {
        ...item,
        id: seedId,
        ownerId: uid,
        createdAt: new Date().toISOString()
      });
    }

    await batch.commit();
    console.log("Successfully seeded user profile and 5 demo leads in database atomic batch.");
  } catch (err) {
    console.warn("Failed atomic registration seed builder:", err);
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const cachedTier = typeof window !== 'undefined' ? localStorage.getItem('leadsradar_subscription_tier') : null;
    if (cachedTier === 'pro' || cachedTier === 'free') {
      return {
        uid: '',
        email: '',
        displayName: 'Outreach Member',
        photoURL: '',
        subscriptionTier: cachedTier as 'free' | 'pro',
        subscriptionPeriod: 'none',
        trialExpires: '',
        subscriptionId: ''
      };
    }
    return null;
  });
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

        // Safely register or seeds the profile only if it does not exist already
        await initializeNewUserProfileAndLeads(
          currentUser.uid,
          currentUser.email || '',
          currentUser.displayName || '',
          currentUser.photoURL || ''
        );

        // Setup real-time listener for current profile parameters
        unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const resolvedTier = data.subscriptionTier || 'free';
            localStorage.setItem('leadsradar_subscription_tier', resolvedTier);
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
            setProfile(null);
          }
          setLoading(false);
        }, (err) => {
          console.error("User profile database sync error:", err);
          const cachedTier = (localStorage.getItem('leadsradar_subscription_tier') as 'free' | 'pro') || 'free';
          // Standard structural fallback for profiles
          setProfile({
            uid: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || 'Outreach Member',
            subscriptionTier: cachedTier,
            subscriptionPeriod: 'none'
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

      // Initialize workspace db profile and seed leads atomically
      await initializeNewUserProfileAndLeads(createdUser.uid, createdUser.email || '', name, '');
    } catch (error) {
      console.error('Email sign up error:', error);
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

  const updateUserSubscription = async (
    tier: 'free' | 'pro', 
    period: 'month' | 'year' | 'none', 
    trialExpires: string = '', 
    subId: string = ''
  ) => {
    if (!user) return;
    localStorage.setItem('leadsradar_subscription_tier', tier);
    const userRef = doc(db, 'users', user.uid);
    try {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || profile?.displayName || 'Outreach Member',
        photoURL: user.photoURL || profile?.photoURL || '',
        subscriptionTier: tier,
        subscriptionPeriod: period,
        trialExpires,
        subscriptionId: subId
      }, { merge: true });
    } catch (err) {
      console.error("Failed to commit subscription update inDB:", err);
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
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
      const response = await fetch('/api/gmail/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uid: user.uid,
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
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        gmailConnected: false,
        gmailEmail: null,
        encryptedGmailToken: null
      }, { merge: true });
    } catch (err) {
      console.error("disconnectGmail action crash:", err);
      throw err;
    }
  };

  const connectOutlook = async (outlookEmail: string) => {
    if (!user) return;
    try {
      // Mock Sandbox outlook persistence
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        outlookConnected: true,
        outlookEmail: outlookEmail
      }, { merge: true });
    } catch (err) {
      console.error("connectOutlook action error:", err);
      throw err;
    }
  };

  const disconnectOutlook = async () => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        outlookConnected: false,
        outlookEmail: null
      }, { merge: true });
    } catch (err) {
      console.error("disconnectOutlook action error:", err);
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
      logout,
      updateUserSubscription,
      gmailAccessToken,
      connectGmail,
      disconnectGmail,
      connectOutlook,
      disconnectOutlook
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
