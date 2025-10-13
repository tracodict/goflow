/**
 * MP3Player Property Configuration
 */

import { PropertyTabConfig } from "../property-config-types"

export const MP3PlayerPropertyConfig: PropertyTabConfig = {
  componentType: "MP3Player",
  sections: [
    {
      title: "Audio",
      fields: [
        {
          key: "data-src",
          label: "Audio Source",
          type: "text",
          placeholder: "https://download.samplelib.com/mp3/sample-3s.mp3",
          helpText: "Provide a direct URL to an MP3 file.",
        },
        {
          key: "data-title",
          label: "Track Title",
          type: "text",
          placeholder: "Sample Track",
        },
      ],
    },
    {
      title: "Playback",
      fields: [
        {
          key: "data-autoplay",
          label: "Autoplay",
          type: "checkbox",
          helpText: "Start playback automatically when the player loads.",
        },
        {
          key: "data-loop",
          label: "Loop",
          type: "checkbox",
          helpText: "Restart playback automatically when the track ends.",
        },
      ],
    },
  ],
}
