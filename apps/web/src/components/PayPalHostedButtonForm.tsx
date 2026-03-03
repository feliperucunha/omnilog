import { useEffect, useState } from "react";
import type { PayPalHostedButton } from "@/config/paypal-hosted-buttons";
import { PAYPAL_HOSTED_FORM_ACTION } from "@/config/paypal-hosted-buttons";

const SUBSCRIBE_IMAGE_DEFAULT = "https://www.paypalobjects.com/en_US/i/btn/btn_subscribe_LG.gif";

interface PayPalHostedButtonFormProps {
  /** Hosted button config from getPayPalHostedButton() */
  config: PayPalHostedButton;
  /** Accessible label for the submit control (e.g. "Subscribe with PayPal") */
  submitAlt?: string;
  /** Optional class for the wrapper div */
  className?: string;
}

/**
 * Renders a form that posts to PayPal's webscr with a hosted subscription button.
 * Use when getPayPalHostedButton(country, interval) returns a config.
 */
export function PayPalHostedButtonForm({
  config,
  submitAlt = "Subscribe with PayPal",
  className,
}: PayPalHostedButtonFormProps) {
  const [origin, setOrigin] = useState<string>("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return (
    <div className={className}>
      <form
        action={PAYPAL_HOSTED_FORM_ACTION}
        method="post"
        target="_top"
        className="flex w-full justify-center"
      >
        <input type="hidden" name="cmd" value="_s-xclick" />
        <input type="hidden" name="hosted_button_id" value={config.hostedButtonId} />
        <input type="hidden" name="currency_code" value={config.currencyCode} />
        {origin && (
          <>
            <input type="hidden" name="return" value={`${origin}/tiers?approved=1`} />
            <input type="hidden" name="cancel_return" value={`${origin}/tiers?canceled=1`} />
          </>
        )}
        <input
          type="image"
          src={config.imageUrl ?? SUBSCRIBE_IMAGE_DEFAULT}
          name="submit"
          alt={submitAlt}
          title={submitAlt}
          className="h-[42px] w-auto cursor-pointer"
        />
      </form>
    </div>
  );
}
