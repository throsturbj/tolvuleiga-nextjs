interface SuccessMessageProps {
  message: string;
  className?: string;
}

export default function SuccessMessage({ message, className = "" }: SuccessMessageProps) {
  return (
    <div className={`rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.236 4.53L7.53 10.53a.75.75 0 00-1.06 1.06l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm text-green-800 dark:text-green-200">{message}</p>
        </div>
      </div>
    </div>
  );
}


