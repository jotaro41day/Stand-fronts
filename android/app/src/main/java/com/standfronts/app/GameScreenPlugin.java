package com.standfronts.app;

import android.view.WindowManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "GameScreen")
public class GameScreenPlugin extends Plugin {
    @PluginMethod
    public void setAwake(PluginCall call) {
        Boolean awake = call.getBoolean("awake");
        if (awake == null) {
            call.reject("awake is required");
            return;
        }
        getActivity().runOnUiThread(() -> {
            if (awake) {
                getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
            call.resolve();
        });
    }
}
