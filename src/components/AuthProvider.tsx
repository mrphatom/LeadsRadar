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
            setProfile({
              uid: data.uid,
              email: data.email,
              displayName: data.displayName,
              photoURL: data.photoURL,
              subscriptionTier: data.subscriptionTier || 'free',
              subscriptionPeriod: data.subscriptionPeriod || 'none',
              trialExpires: data.trialExpires || '',
              subscriptionId: data.subscriptionId || '',
              createdAt: data.createdAt
            });
          } else {
            setProfile(null);
          }
          setLoading(false);
        }, (err) => {
          console.error("User profile database sync error:", err);
          // Standard structural fallback for profiles
          setProfile({
            uid: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || 'Outreach Member',
            subscriptionTier: 'free',
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

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      signInWithGoogle, 
      signInWithEmail, 
      signUpWithEmail, 
      logout,
      updateUserSubscription
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
