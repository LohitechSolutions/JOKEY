import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import Colors from '@/constants/colors';
import { ImageJoke } from '@/types';

interface ImageJokeCardProps {
  joke: ImageJoke;
}

export default React.memo(function ImageJokeCard({ joke }: ImageJokeCardProps) {
  const [aspectRatio, setAspectRatio] = useState<number>(0.87);

  useEffect(() => {
    let mounted = true;
    if (joke.imageUrl) {
      Image.getSize(
        joke.imageUrl,
        (width, height) => {
          if (mounted && width > 0 && height > 0) {
            setAspectRatio(width / height);
          }
        },
        () => {
          // Keep fallback ratio on error
        }
      );
    }
    return () => {
      mounted = false;
    };
  }, [joke.imageUrl]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{joke.title}</Text>
      <Image
        source={{ uri: joke.imageUrl }}
        style={[styles.image, { aspectRatio }]}
        resizeMode="contain"
        accessibilityLabel={joke.title}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  title: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.white,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  image: {
    width: '100%',
    backgroundColor: Colors.surfaceLight,
  },
});
