type ENV = {
  VITE_SCW_PROJECT_ID: string;
  VITE_SCW_DEFAULT_REGION: string;
  VITE_SECURE: string;
  VITE_ENV: 'development' | 'production';
};

const parseEnv = (): ENV => {
  const VITE_SCW_PROJECT_ID = import.meta.env.VITE_SCW_PROJECT_ID;
  const VITE_SCW_DEFAULT_REGION = import.meta.env.VITE_SCW_DEFAULT_REGION;
  const VITE_SECURE = import.meta.env.VITE_SECURE;
  
  return {
    VITE_SCW_PROJECT_ID,
    VITE_SCW_DEFAULT_REGION,
    VITE_SECURE,
    VITE_ENV: import.meta.env.DEV ? 'development' : 'production',
  };
};

export const env = parseEnv();
