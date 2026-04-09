package com.geeklogs.app;

import android.app.Activity;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.android.billingclient.api.*;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;

/**
 * Google Play Billing for Capacitor: query subscription offers and purchase; server verifies token.
 */
@CapacitorPlugin(name = "PlayBilling")
public class PlayBillingPlugin extends Plugin implements PurchasesUpdatedListener {

    private BillingClient billingClient;
    @Nullable
    private PluginCall pendingPurchaseCall;

    @Override
    public void load() {
        super.load();
        billingClient =
            BillingClient.newBuilder(getContext())
                .setListener(this)
                .enablePendingPurchases()
                .build();
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult billingResult, @Nullable List<Purchase> purchases) {
        if (pendingPurchaseCall == null) {
            return;
        }
        final PluginCall call = pendingPurchaseCall;
        pendingPurchaseCall = null;

        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase purchase : purchases) {
                if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                    JSObject out = new JSObject();
                    out.put("purchaseToken", purchase.getPurchaseToken());
                    JSArray products = new JSArray();
                    for (String p : purchase.getProducts()) {
                        products.put(p);
                    }
                    out.put("products", products);
                    runOnMainThread(() -> call.resolve(out));
                    return;
                }
            }
        }

        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            runOnMainThread(() -> call.reject("USER_CANCELED", "USER_CANCELED"));
            return;
        }

        String msg =
            billingResult.getDebugMessage() != null
                ? billingResult.getDebugMessage()
                : ("Billing error " + billingResult.getResponseCode());
        runOnMainThread(() -> call.reject(msg, String.valueOf(billingResult.getResponseCode())));
    }

    private void runOnMainThread(@NonNull Runnable r) {
        Activity a = getActivity();
        if (a != null) {
            a.runOnUiThread(r);
        } else {
            r.run();
        }
    }

    private void ensureConnected(@NonNull Runnable onReady, @NonNull BillingResultConsumer onError) {
        if (billingClient.isReady()) {
            onReady.run();
            return;
        }
        billingClient.startConnection(
            new BillingClientStateListener() {
                @Override
                public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
                    if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        onError.accept(billingResult);
                        return;
                    }
                    onReady.run();
                }

                @Override
                public void onBillingServiceDisconnected() {
                    // Next call will reconnect
                }
            }
        );
    }

    @FunctionalInterface
    private interface BillingResultConsumer {
        void accept(BillingResult r);
    }

    @PluginMethod
    public void querySubscriptionProducts(PluginCall call) {
        if (getActivity() == null) {
            call.reject("No activity");
            return;
        }
        JSArray ids = call.getArray("productIds", null);
        if (ids == null || ids.length() == 0) {
            call.reject("productIds required");
            return;
        }

        List<QueryProductDetailsParams.Product> plist = new ArrayList<>();
        try {
            for (int i = 0; i < ids.length(); i++) {
                String id = ids.getString(i);
                if (id == null || id.isEmpty()) {
                    continue;
                }
                plist.add(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(id)
                        .setProductType(BillingClient.ProductType.SUBS)
                        .build()
                );
            }
        } catch (Exception e) {
            call.reject("Invalid productIds");
            return;
        }

        if (plist.isEmpty()) {
            call.reject("No valid productIds");
            return;
        }

        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder().setProductList(plist).build();

        ensureConnected(
            () ->
                billingClient.queryProductDetailsAsync(
                    params,
                    (billingResult, productDetailsList) -> {
                        if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                            runOnMainThread(
                                () ->
                                    call.reject(
                                        billingResult.getDebugMessage() != null
                                            ? billingResult.getDebugMessage()
                                            : "query failed",
                                        String.valueOf(billingResult.getResponseCode())
                                    )
                            );
                            return;
                        }
                        if (productDetailsList == null || productDetailsList.isEmpty()) {
                            runOnMainThread(() -> call.reject("No products returned from Play Store"));
                            return;
                        }
                        JSObject ret = new JSObject();
                        JSArray out = new JSArray();
                        for (ProductDetails pd : productDetailsList) {
                            JSObject o = new JSObject();
                            o.put("productId", pd.getProductId());
                            List<ProductDetails.SubscriptionOfferDetails> offers = pd.getSubscriptionOfferDetails();
                            if (offers != null && !offers.isEmpty()) {
                                o.put("offerToken", offers.get(0).getOfferToken());
                            }
                            out.put(o);
                        }
                        ret.put("products", out);
                        runOnMainThread(() -> call.resolve(ret));
                    }
                ),
            br ->
                runOnMainThread(
                    () ->
                        call.reject(
                            br.getDebugMessage() != null ? br.getDebugMessage() : "Billing unavailable",
                            String.valueOf(br.getResponseCode())
                        )
                )
        );
    }

    @PluginMethod
    public void purchaseSubscription(PluginCall call) {
        if (getActivity() == null) {
            call.reject("No activity");
            return;
        }
        String productId = call.getString("productId");
        String offerToken = call.getString("offerToken");
        if (productId == null || productId.isEmpty() || offerToken == null || offerToken.isEmpty()) {
            call.reject("productId and offerToken required");
            return;
        }

        pendingPurchaseCall = call;

        List<QueryProductDetailsParams.Product> plist = new ArrayList<>();
        plist.add(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.SUBS)
                .build()
        );
        QueryProductDetailsParams qParams = QueryProductDetailsParams.newBuilder().setProductList(plist).build();

        ensureConnected(
            () ->
                billingClient.queryProductDetailsAsync(
                    qParams,
                    (billingResult, productDetailsList) -> {
                        if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                            pendingPurchaseCall = null;
                            runOnMainThread(
                                () ->
                                    call.reject(
                                        billingResult.getDebugMessage() != null
                                            ? billingResult.getDebugMessage()
                                            : "query failed",
                                        String.valueOf(billingResult.getResponseCode())
                                    )
                            );
                            return;
                        }
                        if (productDetailsList == null || productDetailsList.isEmpty()) {
                            pendingPurchaseCall = null;
                            runOnMainThread(() -> call.reject("Product not found"));
                            return;
                        }
                        ProductDetails details = productDetailsList.get(0);
                        BillingFlowParams.ProductDetailsParams pdp =
                            BillingFlowParams.ProductDetailsParams.newBuilder()
                                .setProductDetails(details)
                                .setOfferToken(offerToken)
                                .build();
                        List<BillingFlowParams.ProductDetailsParams> pdparams = new ArrayList<>();
                        pdparams.add(pdp);
                        BillingFlowParams.Builder flowBuilder =
                            BillingFlowParams.newBuilder().setProductDetailsParamsList(pdparams);
                        String obfuscated = call.getString("obfuscatedAccountId");
                        if (obfuscated != null && !obfuscated.isEmpty()) {
                            flowBuilder.setObfuscatedAccountId(obfuscated);
                        }
                        BillingResult launchResult =
                            billingClient.launchBillingFlow(getActivity(), flowBuilder.build());
                        if (launchResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                            pendingPurchaseCall = null;
                            runOnMainThread(
                                () ->
                                    call.reject(
                                        launchResult.getDebugMessage() != null
                                            ? launchResult.getDebugMessage()
                                            : "launch failed",
                                        String.valueOf(launchResult.getResponseCode())
                                    )
                            );
                        }
                    }
                ),
            br -> {
                pendingPurchaseCall = null;
                runOnMainThread(
                    () ->
                        call.reject(
                            br.getDebugMessage() != null ? br.getDebugMessage() : "Billing unavailable",
                            String.valueOf(br.getResponseCode())
                        )
                );
            }
        );
    }
}
