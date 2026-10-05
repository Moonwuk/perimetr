package ru.moongametechnology.perimeter;
public final class NetworkPolicyCheck {
    private static final String SERVER = "https://game.example";
    private static void check(boolean expected, String origin, String url, String method, boolean mainFrame) {
        if (NetworkPolicy.allows(origin, url, method, mainFrame) != expected) throw new AssertionError(method + " " + url);
    }
    public static void main(String[] args) {
        check(true, SERVER, SERVER + "/api/rooms?code=ABCDEFG", "GET", false);
        check(true, SERVER, SERVER + "/api/rooms", "POST", false);
        check(true, SERVER, SERVER + "/api/rooms", "OPTIONS", false);
        check(true, SERVER, SERVER + "/api/metrics", "POST", false);
        check(true, SERVER, SERVER + "/api/health", "GET", false);
        check(true, SERVER, "https://game.example:443/api/rooms", "GET", false);
        for (String url : new String[]{"http://game.example/api/rooms", "https://game.example.evil.test/api/rooms", "https://game.example@evil.test/api/rooms", "https://evil.test@game.example/api/rooms", "https://game.example:444/api/rooms", SERVER + "/api/metrics/export", SERVER + "/api/rooms/", SERVER + "/api/%72ooms", SERVER + "/api/../api/rooms", SERVER + "/app.js", SERVER + "/api/rooms#fragment", "file:///api/rooms", "garbage"}) check(false, SERVER, url, "GET", false);
        check(false, SERVER, SERVER + "/api/rooms", "GET", true);
        check(false, SERVER, SERVER + "/api/rooms", "DELETE", false);
        check(false, SERVER, SERVER + "/api/metrics", "GET", false);
        check(false, "", SERVER + "/api/rooms", "GET", false);
        check(false, SERVER + "/path", SERVER + "/api/rooms", "GET", false);
        System.out.println("NetworkPolicy: 24 allowlist and rejection checks passed");
    }
}
