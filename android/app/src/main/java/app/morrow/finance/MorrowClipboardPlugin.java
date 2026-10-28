package app.morrow.finance;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.os.PersistableBundle;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MorrowClipboard")
public class MorrowClipboardPlugin extends Plugin {
    @PluginMethod public void write(PluginCall call) {
        try {
            ClipboardManager clipboard = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
            ClipData clip = ClipData.newPlainText("Morrow notes", call.getString("text", ""));
            PersistableBundle extras = new PersistableBundle();
            extras.putBoolean("android.content.extra.IS_SENSITIVE", true);
            clip.getDescription().setExtras(extras);
            clipboard.setPrimaryClip(clip);
            call.resolve();
        } catch (Exception error) { call.reject("Could not copy notes. Export a text file instead."); }
    }
}
