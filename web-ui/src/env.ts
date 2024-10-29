type ENV = {
  VITE_API_URL: string;
  VITE_SECURE: string;
  VITE_ENV: 'development' | 'production';
};

const parseEnv = (): ENV => {
  const VITE_API_URL = import.meta.env.VITE_API_URL;
  const VITE_SECURE = import.meta.env.VITE_SECURE;
  
  return {
    VITE_API_URL,
    VITE_SECURE,
    VITE_ENV: import.meta.env.DEV ? 'development' : 'production',
  };
};

export const env = parseEnv();
