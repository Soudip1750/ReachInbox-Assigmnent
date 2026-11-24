import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../api/hooks';
import { authApi } from '../api/client';
import { Spinner } from '../components/ui/Spinner';

export function LoginPage() {
  const { data: user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (user && typeof user === 'object' && 'id' in user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Handle error from OAuth callback
  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      const messages: Record<string, string> = {
        invalid_state: 'Authentication failed: invalid state. Please try again.',
        invalid_token: 'Authentication failed: invalid token.',
        server_error: 'Server error during authentication. Please try again.',
      };
      toast.error(messages[error] ?? `Authentication failed: ${error}`);
    }
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    toast('Please use "Login with Google" as required by the assignment.', {
      icon: 'ℹ️',
    });
  };

  return (
    <div className="min-h-screen w-full bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-gray-100 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-8 sm:p-10">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-6">Login</h1>

          {/* Google Sign In per Figma */}
          <a
            href={authApi.googleLoginUrl()}
            className="flex items-center justify-center gap-2.5 w-full bg-[#eaf5ed] hover:bg-[#d8eedd] text-[#1b6b33] border border-[#c3e6cd] rounded-xl py-2.5 px-4 text-sm font-medium transition-all shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            <span>Login with Google</span>
          </a>

          {/* Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100" />
            </div>
            <span className="relative bg-white px-3 text-xs text-gray-400">
              or sign up through email
            </span>
          </div>

          {/* Email / Password Form (Mock per Figma UI) */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <input
                type="email"
                placeholder="Email ID"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#f4f6f8] text-gray-800 placeholder-gray-400 text-sm px-4 py-3 rounded-xl border border-transparent focus:border-[#00a859] focus:bg-white focus:outline-none transition-all"
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#f4f6f8] text-gray-800 placeholder-gray-400 text-sm px-4 py-3 rounded-xl border border-transparent focus:border-[#00a859] focus:bg-white focus:outline-none transition-all"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[#00a859] hover:bg-[#00924d] text-white text-sm font-semibold py-3 rounded-xl transition-colors shadow-sm"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
}
