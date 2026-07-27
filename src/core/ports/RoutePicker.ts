/**
 * RoutePicker — ses çıkış cihazı (AirPlay / Bluetooth) seçici PORTU.
 *
 * iOS'ta sistem `AVRoutePickerView` panelini açar. Port arkasında durmasının
 * sebebi: bu tamamen platforma özgü bir yetenektir; UI yalnızca "cihaz seçimini
 * aç" der ve platformu tanımaz.
 *
 * `available` false ise (Android, ya da native modül kurulu değilse) UI
 * düğmeyi pasifleştirir — uygulama yine çalışır.
 */
export interface RoutePicker {
  readonly available: boolean;
  /** Sistem çıkış cihazı seçicisini açar. */
  present(): void;
}
