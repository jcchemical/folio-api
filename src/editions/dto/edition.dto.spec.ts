import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { CreateWorkDto } from '../../works/dto/work.dto.js';
import { CreateEditionRequestDto, UpdateEditionDto } from './edition.dto.js';

const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
});

function metadata(metatype: ArgumentMetadata['metatype']): ArgumentMetadata {
  return { type: 'body', metatype };
}

const firstDescription = {
  sortOrder: 0,
  parts: [
    {
      subfield: 'a',
      value: '245 páginas',
      sortOrder: 0,
    },
    {
      subfield: 'd',
      value: '21 cm',
      sortOrder: 1,
    },
  ],
};

const secondDescription = {
  sortOrder: 1,
  parts: [
    {
      subfield: 'a',
      value: '1 volume',
      sortOrder: 0,
    },
  ],
};

function createEditionPayload() {
  return {
    workId: 'work-1',
    title: 'Edition',
    physicalDescriptions: [firstDescription],
  };
}

async function expectInvalid(
  value: unknown,
  metatype: ArgumentMetadata['metatype'] = CreateEditionRequestDto,
) {
  await expect(
    pipe.transform(value, metadata(metatype)),
  ).rejects.toBeInstanceOf(BadRequestException);
}

describe('Edition Physical Description DTO validation', () => {
  it('accepts one valid Physical Description', async () => {
    const result = await pipe.transform(
      createEditionPayload(),
      metadata(CreateEditionRequestDto),
    );

    expect(result).toBeInstanceOf(CreateEditionRequestDto);
    expect(result.physicalDescriptions).toHaveLength(1);
  });

  it('accepts multiple valid Physical Descriptions', async () => {
    const result = await pipe.transform(
      {
        ...createEditionPayload(),
        physicalDescriptions: [firstDescription, secondDescription],
      },
      metadata(CreateEditionRequestDto),
    );

    expect(result.physicalDescriptions).toHaveLength(2);
  });

  it('rejects a non-array Physical Description value', async () => {
    await expectInvalid({
      ...createEditionPayload(),
      physicalDescriptions: firstDescription,
    });
  });

  it('rejects a non-object array element', async () => {
    await expectInvalid({
      ...createEditionPayload(),
      physicalDescriptions: ['245 páginas'],
    });
  });

  it.each([
    {
      ...firstDescription,
      sortOrder: -1,
    },
    {
      ...firstDescription,
      parts: [],
    },
    {
      ...firstDescription,
      parts: [{ subfield: 'invalid', value: '245 páginas', sortOrder: 0 }],
    },
    {
      ...firstDescription,
      parts: [{ subfield: 'a', value: ' ', sortOrder: 0 }],
    },
    {
      ...firstDescription,
      parts: [{ subfield: 'a', value: '245 páginas', sortOrder: -1 }],
    },
  ])('rejects invalid nested fields', async (physicalDescription) => {
    await expectInvalid({
      ...createEditionPayload(),
      physicalDescriptions: [physicalDescription],
    });
  });

  it('strips extra fields under the global whitelist policy', async () => {
    const result = await pipe.transform(
      {
        ...createEditionPayload(),
        extraRoot: 'removed',
        physicalDescriptions: [
          {
            ...firstDescription,
            extraDescription: 'removed',
            parts: [
              {
                ...firstDescription.parts[0],
                extraPart: 'removed',
              },
            ],
          },
        ],
      },
      metadata(CreateEditionRequestDto),
    );

    expect(result).not.toHaveProperty('extraRoot');
    expect(result.physicalDescriptions?.[0]).not.toHaveProperty(
      'extraDescription',
    );
    expect(result.physicalDescriptions?.[0].parts[0]).not.toHaveProperty(
      'extraPart',
    );
  });

  it('accepts Physical Descriptions on Edition update', async () => {
    const result = await pipe.transform(
      { physicalDescriptions: [firstDescription] },
      metadata(UpdateEditionDto),
    );

    expect(result).toBeInstanceOf(UpdateEditionDto);
    expect(result.physicalDescriptions).toHaveLength(1);
  });

  it('accepts Physical Descriptions on a nested Work Edition', async () => {
    const result = await pipe.transform(
      {
        title: 'Work',
        editions: [
          {
            title: 'Edition',
            physicalDescriptions: [firstDescription],
          },
        ],
      },
      metadata(CreateWorkDto),
    );

    expect(result).toBeInstanceOf(CreateWorkDto);
    expect(result.editions?.[0].physicalDescriptions).toHaveLength(1);
  });

  it('rejects invalid Physical Descriptions on Edition update and nested Work creation', async () => {
    const invalidDescription = {
      ...firstDescription,
      parts: [{ subfield: 'invalid', value: '245 páginas', sortOrder: 0 }],
    };

    await expectInvalid(
      { physicalDescriptions: [invalidDescription] },
      UpdateEditionDto,
    );
    await expectInvalid(
      {
        title: 'Work',
        editions: [
          {
            title: 'Edition',
            physicalDescriptions: [invalidDescription],
          },
        ],
      },
      CreateWorkDto,
    );
  });
});
