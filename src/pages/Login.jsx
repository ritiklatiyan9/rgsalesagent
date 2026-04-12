import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { SignInPage } from '@/components/ui/sign-in';

const sampleTestimonials = [
  {
    avatarSrc: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=128&q=80",
    name: "Sarah Chen",
    handle: "@sarahagent",
    text: "RiverGreen has completely transformed my workflow. The CRM features are incredibly intuitive."
  },
  {
    avatarSrc: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=128&q=80",
    name: "Marcus Johnson",
    handle: "@marcusleads",
    text: "Managing teams and tracking activities has never been easier. Hands down the best portal."
  },
  {
    avatarSrc: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=128&q=80",
    name: "David Martinez",
    handle: "@davidrealestate",
    text: "The lead assignment tracking let me boost my conversion rate by 40%. A must-have."
  },
];

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = formData.get('email');
    const password = formData.get('password');
    setError('');

    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || err?.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setError('Google Sign-In is not enabled yet.');
  };

  const handleResetPassword = () => {
    setError('Please contact administrator to reset your password.');
  };

  const handleCreateAccount = () => {
    setError('Agent accounts must be created by administration.');
  };

  return (
    <SignInPage
      title={
        <span className="font-bold text-slate-900 tracking-tight">
         DG Sales Portal
        </span>
      }
      description="Agent & Team Lead Access"
      heroImageSrc="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=2160&q=80"
      
      onSignIn={handleSignIn}
      onGoogleSignIn={handleGoogleSignIn}
      onResetPassword={handleResetPassword}
      onCreateAccount={handleCreateAccount}
      error={error}
      loading={loading}
    />
  );
};

export default Login;
