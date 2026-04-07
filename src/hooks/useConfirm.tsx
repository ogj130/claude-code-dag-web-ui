import { useState, useCallback } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';

type ButtonVariant = 'default' | 'danger' | 'ghost';

interface ConfirmButton {
  label: string;
  onClick: () => void;
  variant?: ButtonVariant;
}

interface ConfirmOptions {
  title: string;
  message: React.ReactNode;
  buttons: ConfirmButton[];
}

export function useConfirm() {
  const [dialog, setDialog] = useState<ConfirmOptions | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<void>(resolve => {
      setDialog({
        ...options,
        buttons: options.buttons.map(btn => ({
          ...btn,
          onClick: () => {
            btn.onClick();
            setDialog(null);
            resolve();
          },
        })),
      });
    });
  }, []);

  const close = useCallback(() => setDialog(null), []);

  const DialogComponent = dialog ? (
    <ConfirmDialog
      title={dialog.title}
      message={dialog.message}
      buttons={dialog.buttons}
    />
  ) : null;

  return { confirm, close, DialogComponent };
}
