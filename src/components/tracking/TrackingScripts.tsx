import Script from "next/script";
import { publicEnv } from "@/lib/env";

export function TrackingScripts() {
  const t = publicEnv.tracking;
  if (!t.enabled) return null;

  const gaId = t.gaMeasurementId.trim();
  const gtmId = t.googleTagId.trim();
  const fbId = t.metaPixelId.trim();

  const anyGoogle = gaId.length > 0 || gtmId.length > 0;

  return (
    <>
      {anyGoogle ? (
        <>
          {gaId && (
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`}
              strategy="afterInteractive"
            />
          )}
          <Script id="ga-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              ${gaId ? `gtag('config', ${JSON.stringify(gaId)});` : ""}
              ${gtmId ? `gtag('config', ${JSON.stringify(gtmId)});` : ""}
            `}
          </Script>
          {gtmId && (
            <Script id="gtm-init" strategy="afterInteractive">
              {`
                (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer', ${JSON.stringify(gtmId)});
              `}
            </Script>
          )}
        </>
      ) : null}
      {fbId ? (
        <Script id="fb-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', ${JSON.stringify(fbId)});
            fbq('track', 'PageView');
          `}
        </Script>
      ) : null}
    </>
  );
}
