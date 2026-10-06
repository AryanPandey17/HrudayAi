# Heart model: source and licence

`frontend/public/models/heart.glb` is a derivative of **BodyParts3D** release 3.0.

- Source: BodyParts3D, © The Database Center for Life Science (DBCLS), licensed under
  Creative Commons Attribution-Share Alike 2.1 Japan (CC BY-SA 2.1 JP).
- Obtained from the mirror at https://github.com/Kevin-Mattheus-Moerman/BodyParts3D
  (`assets/BodyParts3D_data/stl`).
- Licence text: https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en

## Parts used (FMA ids)

| Mesh in `heart.glb` | BodyParts3D parts |
|---|---|
| `heart_wall` | FMA7274 wall of heart |
| `aorta` | FMA3736 ascending aorta, FMA3768 arch of aorta, FMA3784 descending aorta (cropped) |
| `pulmonary_arteries` | FMA66326 pulmonary artery (trunk and main branches only) |
| `pulmonary_veins` | FMA66643 pulmonary vein (segments near the heart only) |
| `venae_cavae` | FMA4720 superior vena cava, FMA10951 inferior vena cava (cropped) |
| `left_main` | FMA4685 stem of left coronary artery |
| `LAD` | FMA3862 anterior interventricular branch of left coronary artery, FMA71670 its septal branches |
| `LCX` | FMA3895 circumflex branch of left coronary artery |
| `RCA` | FMA3802 trunk of right coronary artery, FMA3818 marginal branch, FMA3840 posterior interventricular branch, FMA76994 right posterolateral branch, FMA71669 septal branches |

## Changes made

Meshes were merged per structure, cropped to the region around the heart, simplified
(about 590,000 source triangles to about 75,000), re-centred, rescaled, converted to glTF and
compressed with meshopt. `build_heart_model.py` in this folder reproduces every step.

Because the source is share-alike, `heart.glb` is distributed under the same CC BY-SA 2.1 JP
licence. It is reference anatomy of one model body, not any patient's imaging.
