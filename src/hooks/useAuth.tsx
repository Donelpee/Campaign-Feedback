import {
  useState,
  useEffect,
  createContext,
  useContext,
  ReactNode,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type {
  AppRole,
  ProfileAccountType,
  RespondentNamePreference,
} from "@/lib/supabase-types";

export const AUTH_BYPASS_MODE = false;

const MOCK_ADMIN_USER = {
  id: "local-admin-user",
  email: "admin@local.dev",
} as User;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  bypassAuth: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    profileOptions?: {
      accountType: ProfileAccountType;
      respondentNamePreference: RespondentNamePreference;
      organizationName?: string;
    },
  ) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (AUTH_BYPASS_MODE) {
      setUser(MOCK_ADMIN_USER);
      setSession(null);
      setIsAdmin(true);
      setIsLoading(false);
      return;
    }

    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      // Defer admin check with setTimeout
      if (session?.user) {
        setTimeout(() => {
          checkAdminStatus(session.user.id);
        }, 0);
      } else {
        setIsAdmin(false);
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        checkAdminStatus(session.user.id);
      }

      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .in("role", ["admin", "super_admin"] as AppRole[]);

      if (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
        return;
      }

      setIsAdmin(data && data.length > 0);
    } catch (err) {
      console.error("Error in checkAdminStatus:", err);
      setIsAdmin(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    if (AUTH_BYPASS_MODE) {
      setUser(MOCK_ADMIN_USER);
      setIsAdmin(true);
      return { error: null };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    return { error: error as Error | null };
  };

  const signInWithMagicLink = async (email: string) => {
    if (AUTH_BYPASS_MODE) {
      setUser(MOCK_ADMIN_USER);
      setIsAdmin(true);
      return { error: null };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const redirectTo = `${window.location.origin}/auth`;

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    return { error: error as Error | null };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    profileOptions?: {
      accountType: ProfileAccountType;
      respondentNamePreference: RespondentNamePreference;
      organizationName?: string;
    },
  ) => {
    if (AUTH_BYPASS_MODE) {
      setUser(MOCK_ADMIN_USER);
      setIsAdmin(true);
      return { error: null };
    }

    const redirectUrl = `${window.location.origin}/`;
    const normalizedEmail = email.trim().toLowerCase();

    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          account_type: profileOptions?.accountType || "organization",
          respondent_name_preference:
            profileOptions?.accountType === "individual"
              ? "individual_name"
              : profileOptions?.respondentNamePreference || "organization_name",
          organization_name:
            profileOptions?.accountType === "organization"
              ? profileOptions?.organizationName?.trim() || fullName
              : "",
        },
      },
    });
    return { error: error as Error | null };
  };

  const resetPassword = async (email: string) => {
    if (AUTH_BYPASS_MODE) {
      return { error: null };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const redirectTo = `${window.location.origin}/auth`;

    const { error } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo,
      },
    );

    return { error: error as Error | null };
  };

  const signOut = async () => {
    if (AUTH_BYPASS_MODE) {
      return;
    }

    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAdmin,
        bypassAuth: AUTH_BYPASS_MODE,
        signIn,
        signInWithMagicLink,
        signUp,
        resetPassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
