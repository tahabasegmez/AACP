/**
 * TemplateStack — CarPlay şablon yığınının bizdeki modeli.
 *
 * NEDEN GEREKLİ: `react-native-carplay` yığını sorgulamanın bir yolunu
 * vermez, ama iOS iki kuralı SERT uygular ve ihlalinde uygulamayı çökertir:
 *
 *   1. Aynı şablon yığına İKİ KEZ eklenemez,
 *   2. `popToTemplate` yığında OLMAYAN bir şablonla çağrılamaz.
 *
 * Now Playing şablonu bir SİNGLETON olduğu ("shared template") ve sistemin
 * kendisi de onu açabildiği için, "acaba yığında mı" sorusunu birkaç boolean
 * ile tahmin etmek yetmiyordu: sistemin bizden habersiz açtığı bir Now Playing,
 * bizim sonraki `push` çağrımızı çökme sebebine çeviriyordu.
 *
 * Model bu yüzden yalnızca kendi çağrılarımızla değil, sistemin gönderdiği
 * "şablon göründü" olaylarıyla da DÜZELTİLİR. Değişmez kural şudur:
 *
 *   > bir şablon göründüyse, o an yığının tepesindedir.
 *
 * Kullanıcının "geri" tuşu, sistemin kendi gezinmesi ve bizim itmelerimiz —
 * üçü de bu tek kuraldan geçer.
 *
 * Kök (sekme çubuğu) yığında TUTULMAZ; `depth === 0` kökteyiz demektir.
 */
export class TemplateStack {
  private ids: string[] = [];

  /** Kökün üstündeki şablon sayısı. */
  get depth(): number {
    return this.ids.length;
  }

  /** Tepedeki şablon (kökteyken undefined). */
  top(): string | undefined {
    return this.ids[this.ids.length - 1];
  }

  contains(id: string): boolean {
    return this.ids.includes(id);
  }

  /** Biz bir şablon ittik. */
  pushed(id: string): void {
    this.ids.push(id);
  }

  /** Biz bir şablona geri döndük (üstündekiler gitti). */
  poppedTo(id: string): void {
    const at = this.ids.indexOf(id);
    if (at >= 0) {
      this.ids = this.ids.slice(0, at + 1);
    }
  }

  /**
   * Sistem "bu şablon göründü" dedi — model buna göre düzeltilir.
   *
   * @param isRoot Görünen şablon kök sekmelerden biri mi? Öyleyse yığın boştur.
   */
  didAppear(id: string, isRoot: boolean): void {
    if (isRoot) {
      this.ids = [];
      return;
    }
    const at = this.ids.indexOf(id);
    if (at >= 0) {
      // Bilinen şablon: üstündekiler kapanmış demektir.
      this.ids = this.ids.slice(0, at + 1);
      return;
    }
    // Bilinmeyen şablon: sistem bizden habersiz itmiş (ör. aracın kendi
    // "şimdi çalıyor" düğmesi). Yok saymak, bir sonraki itişimizi çökme
    // sebebine çevirirdi.
    this.ids.push(id);
  }

  /** Bağlantı koptu: şablonlar araçla birlikte gitti. */
  clear(): void {
    this.ids = [];
  }
}
