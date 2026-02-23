import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, AlertCircle } from 'lucide-react';
import Logo from '../assets/Logo2.svg';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Initial splash screen duration
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const { error } = await signIn(email, password);
      if (error) throw error;
      
      setIsSuccess(true);
      // Wait for success animation before navigating
      setTimeout(() => {
        navigate('/');
      }, 1200);
    } catch (err) {
      setError('Credenciales inválidas. Por favor verifique su email y contraseña.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 overflow-hidden relative font-sans">
      {/* SUCCESS OVERLAY / INITIAL SPLASH */}
      {(showSplash || isSuccess) && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a] transition-opacity duration-700 ${!isSuccess && !showSplash ? 'opacity-0' : 'opacity-100'}`}>
          {/* White Impact Flash */}
          {isSuccess && (
            <div className="absolute inset-0 bg-white animate-pulse opacity-0 [animation-iteration-count:1] [animation-duration:1.2s] pointer-events-none z-10"></div>
          )}
          
          <div className="relative z-20">
            <img 
              src={Logo} 
              alt="Logo" 
              className={`w-48 sm:w-64 h-auto select-none ${isSuccess ? 'animate-zoom-explosion' : 'animate-intro-logo animate-pulse-logo'}`} 
            />
          </div>
        </div>
      )}

      {/* LOGIN CARD */}
      <div className={`max-w-md w-full bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-[2.5rem] shadow-2xl text-center transform transition-all duration-1000 ${showSplash ? 'opacity-0 translate-y-10' : 'animate-reveal-login'}`}>
        <img 
          src={Logo} 
          alt="StockSystem Logo" 
          className="w-24 sm:w-32 h-auto mx-auto mb-8 opacity-90 drop-shadow-[0_0_15px_rgba(99,102,241,0.4)]" 
        />
        
        <h2 className="text-3xl font-medium text-white mb-8 tracking-tight">Bienvenido de nuevo</h2>

        <form onSubmit={handleSubmit} className="space-y-6 text-left">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-sm flex items-start space-x-2 animate-reveal-login">
              <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Correo electrónico</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full bg-black/20 border border-white/10 pl-11 pr-4 py-3.5 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="tu@empresa.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full bg-black/20 border border-white/10 pl-11 pr-4 py-3.5 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || isSuccess}
            className="w-full relative group overflow-hidden bg-primary-600 hover:bg-primary-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary-600/20 transition-all duration-300 transform hover:-translate-y-1 active:scale-[0.98] disabled:opacity-50"
          >
            <span className="relative z-10 flex items-center justify-center">
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                </div>
              ) : 'Entrar al Panel'}
            </span>
          </button>
        </form>
      </div>

      {/* Decorative background gradients */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary-600/20 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
    </div>
  );
}
