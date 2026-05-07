{pkgs}: {
  deps = [
    pkgs.xvfb-run
    pkgs.libxkbcommon
    pkgs.gtk3
    pkgs.alsa-lib
    pkgs.mesa
    pkgs.libdrm
    pkgs.cups
    pkgs.atk
    pkgs.nss
    pkgs.chromium
  ];
}
