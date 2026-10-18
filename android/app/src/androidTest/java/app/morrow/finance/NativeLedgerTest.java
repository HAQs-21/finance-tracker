package app.morrow.finance;

import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.os.Build;
import android.os.SystemClock;
import android.view.KeyEvent;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Real WebView -> Capacitor -> SQLite coverage. Run only on a disposable emulator. */
@RunWith(AndroidJUnit4.class)
public class NativeLedgerTest {
    private ActivityScenario<MainActivity> scenario;
    private final Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();

    private String evaluate(String expression) throws Exception {
        CountDownLatch completed = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(expression, value -> {
            result.set(value);
            completed.countDown();
        }));
        assertTrue("WebView did not respond", completed.await(10, TimeUnit.SECONDS));
        return result.get();
    }

    private void run(String script) throws Exception {
        String result = evaluate("(()=>{try{" + script + ";return 'ok'}catch(e){return 'ERROR:'+e.stack}})()");
        assertFalse(result, result.contains("ERROR:"));
    }

    private void waitFor(String condition) throws Exception {
        long deadline = SystemClock.uptimeMillis() + 20000;
        while (SystemClock.uptimeMillis() < deadline) {
            if ("true".equals(evaluate("Boolean(" + condition + ")"))) return;
            SystemClock.sleep(100);
        }
        fail("Timed out: " + condition + "\n" + evaluate("document.body.innerText"));
    }

    private void helpers() throws Exception {
        run("window.__click=(text,scope='body')=>{const e=[...document.querySelector(scope).querySelectorAll('button')].find(b=>b.textContent.trim()===text);if(!e)throw Error('Missing button '+text);e.click()};"
            + "window.__fill=(selector,value)=>{const e=document.querySelector(selector);if(!e)throw Error('Missing field '+selector);const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,value);e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}))}");
    }

    private void plan() throws Exception {
        run("__click('Plan','.mobile-nav')");
        waitFor("document.querySelector('.savings-card')");
    }

    private void settings() throws Exception {
        run("__click('My space','.mobile-nav')");
        waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Restore JSON')");
    }

    private void earnings(String amount) throws Exception {
        run("__click('Add earnings','.savings-card')");
        waitFor("document.querySelector('[role=dialog] input[aria-label=\"Amount in PKR\"]')");
        run("__fill('[role=dialog] input[aria-label=\"Amount in PKR\"]'," + JSONObject.quote(amount) + ")");
        run("__click('Add to Savings','[role=dialog]')");
        waitFor("!document.querySelector('[role=dialog]')");
    }

    private void restore(String backup, boolean recovery) throws Exception {
        if (!recovery) {
            settings();
            run("__click('Restore JSON')");
            waitFor("document.querySelector('[role=dialog] textarea')");
        }
        run("__fill('textarea'," + JSONObject.quote(backup) + ")");
        run("__click('" + (recovery ? "Verify backup" : "Verify and preview") + "')");
        waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Restore this backup')");
        run("__click('Restore this backup')");
        waitFor("!document.querySelector('[role=dialog]') && document.querySelector('.mobile-nav') && !document.querySelector('.recovery-page')");
    }

    private SQLiteDatabase database() {
        return SQLiteDatabase.openDatabase(context.getDatabasePath("morrowSQLite.db").getPath(), null, SQLiteDatabase.OPEN_READWRITE);
    }

    private long scalar(String sql) {
        try (SQLiteDatabase database = database(); Cursor cursor = database.rawQuery(sql, null)) {
            assertTrue(cursor.moveToFirst());
            return cursor.getLong(0);
        }
    }

    private String ledgerRows() {
        StringBuilder result = new StringBuilder();
        try (SQLiteDatabase database = database()) {
            for (String table : new String[] {"categories", "templates", "budgets", "journal"}) {
                try (Cursor cursor = database.rawQuery("SELECT data FROM " + table + " ORDER BY id", null)) {
                    while (cursor.moveToNext()) result.append(table).append(':').append(cursor.getString(0)).append('\n');
                }
            }
        }
        return result.toString();
    }

    private String read(File file) throws Exception {
        try (FileInputStream input = new FileInputStream(file); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] bytes = new byte[8192];
            int count;
            while ((count = input.read(bytes)) != -1) output.write(bytes, 0, count);
            return new String(output.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    @Test(timeout = 240000)
    public void startupSpendingExportRestoreAndDamagedDatabaseRecovery() throws Exception {
        // Never mutate a person's phone. The CLI invocation additionally targets one emulator serial.
        assumeTrue("Disposable Android emulator required", Build.HARDWARE.contains("ranchu") || Build.HARDWARE.contains("goldfish"));
        context.deleteDatabase("morrowSQLite.db");
        File exported = new File(context.getCacheDir(), "exports/Morrow-recovery.json");
        if (exported.exists()) assertTrue(exported.delete());
        scenario = ActivityScenario.launch(MainActivity.class);
        try {
            waitFor("document.querySelector('.savings-card')");
            helpers();
            assertEquals(7, scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('metadata','archives','categories','templates','budgets','journal','recoveries')"));
            // Successful startup itself regresses the PRAGMA-through-execSQL crash.
            earnings("40000");
            run("__click('New budget')");
            waitFor("document.querySelector('select[aria-label=\"Budget category\"]')");
            run("__fill('select[aria-label=\"Budget category\"]',[...document.querySelector('select[aria-label=\"Budget category\"]').options].find(o=>o.textContent==='Food').value)");
            run("__fill('input[aria-label=\"Monthly budget amount\"]','8000')");
            run("__click('Create budget','[role=dialog]')");
            waitFor("!document.querySelector('[role=dialog]') && document.querySelector('.budget-card')");
            run("__click('Add expense','.budget-card')");
            waitFor("document.querySelector('input[aria-label=\"Amount in PKR\"]')");
            run("__fill('input[aria-label=\"Amount in PKR\"]','1200')");
            run("__fill('input[aria-label=\"Transaction note\"]','Native lunch — اردو')");
            run("__click('Record expense','[role=dialog]')");
            waitFor("!document.querySelector('[role=dialog]')");
            assertEquals(3200000, scalar("SELECT SUM(savingsDelta) FROM journal"));
            assertEquals(680000, scalar("SELECT SUM(budgetDelta) FROM journal"));
            String original = ledgerRows();
            scenario.recreate();
            waitFor("document.querySelector('.savings-card')");
            helpers();
            assertEquals(original, ledgerRows());

            // Exercise the actual native export, not a manually constructed Morrow backup.
            settings();
            run("__click('Complete JSON')");
            long deadline = SystemClock.uptimeMillis() + 15000;
            while (!exported.isFile() && SystemClock.uptimeMillis() < deadline) SystemClock.sleep(100);
            assertTrue("Native recovery export was not written", exported.isFile());
            String complete = read(exported);
            assertEquals("morrow-backup", new JSONObject(complete).getString("format"));
            SystemClock.sleep(700);
            InstrumentationRegistry.getInstrumentation().getUiAutomation().injectInputEvent(new KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_BACK), true);
            InstrumentationRegistry.getInstrumentation().getUiAutomation().injectInputEvent(new KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_BACK), true);
            SystemClock.sleep(300);
            context.startActivity(context.getPackageManager().getLaunchIntentForPackage(context.getPackageName()).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK));
            plan();
            earnings("5000");
            assertEquals(3700000, scalar("SELECT SUM(savingsDelta) FROM journal"));
            restore(complete, false);
            assertEquals(original, ledgerRows());
            assertTrue(scalar("SELECT COUNT(*) FROM recoveries") > 0);

            // Legacy Finance Tracker JSON must also restore through the native adapter.
            String legacy = "{\"transactions\":[{\"id\":1,\"type\":\"INCOME\",\"amount\":40000,\"date\":\"DATE\",\"description\":\"Legacy earnings\"},{\"id\":2,\"type\":\"EXPENSE\",\"amount\":3000,\"category\":\"Food\",\"date\":\"DATE\",\"description\":\"Legacy lunch — اردو\"}],\"budgets\":[{\"category\":\"Food@MONTH\",\"amount\":8000,\"month\":\"MONTH\"}],\"savings\":[]}";
            String date = new JSONObject("{\"date\":" + evaluate("new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0')+'-'+String(new Date().getDate()).padStart(2,'0')") + "}").getString("date");
            legacy = legacy.replace("DATE", date).replace("MONTH", date.substring(0, 7));
            restore(legacy, false);
            assertEquals(3200000, scalar("SELECT SUM(savingsDelta) FROM journal"));
            assertEquals(500000, scalar("SELECT SUM(budgetDelta) FROM journal"));
            assertEquals(1, scalar("SELECT COUNT(*) FROM archives WHERE id='legacy'"));

            // Simulate metadata damage on this disposable database, keeping all rows in place.
            try (SQLiteDatabase database = database()) {
                database.execSQL("UPDATE metadata SET data = ? WHERE key = 'state'", new Object[] {"{\"invalid\":true}"});
            }
            scenario.recreate();
            waitFor("document.querySelector('.recovery-page')");
            helpers();
            restore(complete, true);
            assertEquals(original, ledgerRows());
            assertTrue(scalar("SELECT COUNT(*) FROM recoveries WHERE reason='Raw database before recovery restore'") > 0);
            scenario.recreate();
            waitFor("document.querySelector('.mobile-nav') && !document.querySelector('.recovery-page')");
            assertEquals(original, ledgerRows());
        } finally {
            scenario.close();
        }
    }
}
