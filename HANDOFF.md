# Confirmed handoff format

Each confirmation produces a self-contained Venture_3D_Confirmed_Handoff.zip. The filenames at the ZIP root are model.glb, model-manifest.json, project.json, preview.png and README.txt. Editable projects and the latest confirmed record occupy separate browser storage slots. Download backups for use on another device.

Manifest schema version 1.0.0 uses these fields:

| Field | Meaning |
| --- | --- |
| schemaVersion | Semantic version of this contract |
| confirmationId, confirmedAt | Unique UUID and UTC timestamp of this confirmation |
| projectName, modelName, modelType, description | User-facing labels and product description |
| dimensions | Axis-aligned width (X), height (Y), depth (Z) of the exported scene in meters |
| camera | Preferred viewer framing including position, target, projection and zoom; coordinates in meters |
| background, lighting | Studio background color and lighting preset |
| hotspots | Optional feature descriptions; defaults to an empty array |
| files | Relative root filenames keyed by model, manifest, project, preview, instructions |
| integrity | Digest algorithm (SHA-256), filename and lowercase hex digest of the complete GLB |

The model uses glTF 2.0 with embedded resources, meter units and Y-up orientation. A consumer should validate the digest before use and ignore unknown optional manifest fields. Incompatible contract changes require a new major schema version.
