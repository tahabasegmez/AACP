# shared/components

Birden fazla feature'ın paylaştığı sunum bileşenleri buraya (ör. `Button`,
`ArtworkImage`, `EmptyState`, `ErrorView`). Bir bileşen yalnızca tek bir
feature'a aitse, o feature'ın kendi `components/` klasöründe kalmalı.

Kural: buradaki bileşenler "aptal" (dumb) olmalı — iş mantığı/veri çağrısı
içermez, yalnızca prop alıp gösterir.
